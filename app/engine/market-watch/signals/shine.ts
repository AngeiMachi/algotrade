import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../../../config/globals.config';
import { MarketWatchConfig } from '../../../config/market-watch.config';
import { RaceRulesConfig } from '../../../config/race-rules.config';
import { candleRelativeVolume } from '../alert-score';
import { smaPathAtHour } from '../hourly-sma';
import { IAlertBadge, IMarketAlert, IWatchBar, IWatchFacts, IWatchSignal } from '../market-watch.types';

// The trader's red-day alert. On days the whole market opens red there is little or nothing on the board, and as the
// session runs some stocks keep falling while others surprise and turn from red to green: those are the ones to buy.
// Switched on by the trader; then every stock is watched, on or off the board. On the 5-minute chart: the stock lost
// the 200 SMA (opened under it, or a candle since the bell closed under it), then a candle closes back above both the
// 200 SMA and the fast SMA (the chart's red line). It must do it tight and slow (never far under the 200, no jump back)
// with real volume, or the stock is out for the day. Only in the first hour and a half (not the first 10 minutes),
// once per stock per day. Crossing above yesterday's close (green on the day) is shown on the alert.

const NEW_YORK = 'America/New_York';
const settings = () => MarketWatchConfig.shine;
const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
const pct = (from: number, to: number) => ((from - to) / to) * 100;

// The SMAs of the 24-hour 5-minute chart: the history before 04:00, then today's candles.
interface IChart {
    closes: number[];
    offset: number; // index in `closes` of today's first candle (allBars[0])
}

const chartOf = (prior: number[], facts: IWatchFacts): IChart => ({ closes: [...prior, ...facts.allBars.map((bar) => bar.close)], offset: prior.length });

// The SMA through today's candle `barIndex` (-1 = through the last candle before today's 04:00); null without enough closes.
const smaAt = (chart: IChart, barIndex: number, period: number): number | null => {
    const end = chart.offset + barIndex + 1;
    return end >= period ? _.mean(chart.closes.slice(end - period, end)) : null;
};

// The 200 SMA as a band. Where the overnight is thin the trader's chart has candles Alpaca lacks and his 200 SMA sits
// between ours and the same with the empty overnight slots filled; on a stock traded all night both are one line. Lost
// = closed under the band's bottom, won back = closed above its top. The fast SMA is the same either way.
interface ISlowBand {
    low: number;
    high: number;
}

interface ICharts {
    asIs: IChart;
    filled: IChart;
}

const slowBandAt = (charts: ICharts, barIndex: number): ISlowBand | null => {
    const asIs = smaAt(charts.asIs, barIndex, settings().slowSmaPeriod);
    const filled = smaAt(charts.filled, barIndex, settings().slowSmaPeriod);
    return asIs === null ? null : { low: Math.min(asIs, filled ?? asIs), high: Math.max(asIs, filled ?? asIs) };
};

const bandText = (band: ISlowBand) =>
    band.high - band.low < 0.005 ? band.high.toFixed(2) : `${band.low.toFixed(2)}–${band.high.toFixed(2)}`;

interface IReading {
    bar: IWatchBar;
    slow: ISlowBand;
    fast: number;
}

interface IHourlySlide {
    dropAtr: number; // how far the hourly 20 SMA fell over slideHours, daily ATRs (negative = rose)
    fallingHours: number; // of the last slideRecentHours hourly steps, how many fell
}

interface IWinBack extends IReading {
    dipAtr: number; // deepest low under the 200 SMA since the bell
    rangeAtr: number; // the candle's high to low
    slide: IHourlySlide | null; // null without enough hourly history
    volumeRatio: number | null; // the candle's volume against the same candle on recent days
    fault: string | null; // why it does not count (the stock is out for the day); null = alert
}

interface IShineDay {
    lost: { how: string } | null; // how it lost the 200 SMA
    winBack: IWinBack | null; // the candle that closed back above both, from the third candle on
    last: IReading | null; // the last closed candle read
    windowOver: boolean;
}

const atrOf = (facts: IWatchFacts, price: number) => ((facts.atrPct > 0 ? facts.atrPct : RaceRulesConfig.fallbackAtrPct) / 100) * price;

// Why a win back does not count; null when it is tight, slow and busy enough.
const faultOf = (winBack: Omit<IWinBack, 'fault'>): string | null => {
    const { minCandleVolume, maxDipAtr, maxTriggerRangeAtr, slowSmaPeriod } = settings();
    if (winBack.volumeRatio !== null && winBack.volumeRatio < minCandleVolume) {
        return `quiet: candle volume ${winBack.volumeRatio.toFixed(2)}× normal (min ${minCandleVolume})`;
    }
    if (winBack.dipAtr > maxDipAtr) {
        return `loose: fell ${winBack.dipAtr.toFixed(2)} ATR under the ${slowSmaPeriod} SMA (max ${maxDipAtr})`;
    }
    if (winBack.rangeAtr > maxTriggerRangeAtr) {
        return `jumped back: a ${winBack.rangeAtr.toFixed(2)} ATR candle (max ${maxTriggerRangeAtr})`;
    }
    if (isSliding(winBack.slide)) {
        return `sliding: ${slideText(winBack.slide!)}`;
    }
    return null;
};

const hourlySlideAt = (facts: IWatchFacts, bar: IWatchBar): IHourlySlide | null => {
    const { slideHours, slideRecentHours } = settings();
    const path = smaPathAtHour(facts, globalConfig.PremarketRace.smaPeriod, bar.time.substring(0, 2), bar.close, Math.max(slideHours, slideRecentHours));
    if (!path) {
        return null;
    }
    const recent = _.takeRight(path, slideRecentHours + 1);
    const steps = recent.slice(1).map((value, i) => value - recent[i]);
    return {
        dropAtr: (path[path.length - 1 - slideHours] - _.last(path)!) / atrOf(facts, bar.close),
        fallingHours: steps.filter((step) => step < 0).length,
    };
};

const isSliding = (slide: IHourlySlide | null) =>
    !!slide && slide.dropAtr >= settings().slideDropAtr && slide.fallingHours >= settings().slideFallingHours;

const slideText = (slide: IHourlySlide) => {
    const { slideHours, slideRecentHours } = settings();
    return (
        `the hourly 20 SMA ${slide.dropAtr >= 0 ? 'fell' : 'rose'} ${Math.abs(slide.dropAtr).toFixed(2)} ATR over ${slideHours} hours, ` +
        `down in ${slide.fallingHours} of the last ${slideRecentHours}`
    );
};

// Walks the session's closed candles in the window: where it lost the 200 SMA and where it won it back.
const readDay = (facts: IWatchFacts): IShineDay | null => {
    if (!facts.prior5MinCloses || facts.openingPrice === null || facts.bars.length === 0) {
        return null;
    }
    const charts: ICharts = { asIs: chartOf(facts.prior5MinCloses.closes, facts), filled: chartOf(facts.prior5MinCloses.filledCloses, facts) };
    const { windowMinutes, ignoreFirstMinutes, minLossAtr, fastSmaPeriod } = settings();
    const firstIndex = facts.allBars.indexOf(facts.bars[0]);
    const bell = moment(facts.bars[0].time, 'HH:mm');
    const windowEnd = bell.clone().add(windowMinutes, 'minutes').format('HH:mm');
    const validFrom = bell.clone().add(ignoreFirstMinutes, 'minutes').format('HH:mm');
    const slowAtOpen = slowBandAt(charts, firstIndex - 1);
    if (slowAtOpen === null) {
        return null;
    }
    const day: IShineDay = {
        lost:
            slowAtOpen.low - facts.openingPrice >= minLossAtr * atrOf(facts, slowAtOpen.low)
                ? { how: `opened ${facts.openingPrice.toFixed(2)} under it (${bandText(slowAtOpen)})` }
                : null,
        winBack: null,
        last: null,
        windowOver: false,
    };
    let deepest = Math.max(0, slowAtOpen.low - facts.openingPrice);
    for (let index = firstIndex; index < facts.allBars.length; index++) {
        const bar = facts.allBars[index];
        const slow = slowBandAt(charts, index);
        const fast = smaAt(charts.asIs, index, fastSmaPeriod);
        if (bar.time >= windowEnd) {
            day.windowOver = true;
            break;
        }
        if (bar.forming || slow === null || fast === null) {
            break;
        }
        day.last = { bar, slow, fast };
        deepest = Math.max(deepest, slow.low - bar.low);
        if (!day.lost) {
            if (slow.low - bar.close >= minLossAtr * atrOf(facts, slow.low)) {
                day.lost = { how: `the ${bar.time} candle closed ${bar.close.toFixed(2)} under it (${bandText(slow)})` };
            }
        } else if (bar.close > slow.high && bar.close > fast) {
            if (bar.time < validFrom) {
                day.lost = null;
                deepest = 0;
                continue;
            }
            const atr = atrOf(facts, bar.close);
            const reading = {
                bar,
                slow,
                fast,
                dipAtr: deepest / atr,
                rangeAtr: (bar.high - bar.low) / atr,
                slide: hourlySlideAt(facts, bar),
                volumeRatio: candleRelativeVolume(facts, bar.time),
            };
            day.winBack = { ...reading, fault: faultOf(reading) };
            break;
        }
    }
    return day;
};

// The first closed candle from `fromTime` on (any time of the session) that closes above yesterday's close.
const turnedGreen = (facts: IWatchFacts, fromTime: string, previousClose: number): IWatchBar | null =>
    facts.bars.find((bar) => bar.time >= fromTime && !bar.forming && bar.close > previousClose) ?? null;

const greenBadge = (previousClose: number, price: number, when: string): IAlertBadge => ({
    id: 'green-day',
    label: 'Green on the day',
    detail: `${when} ${price.toFixed(2)}, ${signed(pct(price, previousClose))}% above yesterday's close (${previousClose.toFixed(2)})`,
});

const alertsOf = (facts: IWatchFacts, day: IShineDay, winBack: IWinBack): IMarketAlert[] => {
    const { bar, slow, fast, volumeRatio } = winBack;
    const { slowSmaPeriod, fastSmaPeriod } = settings();
    const eventId = `shine:${facts.quote}:${facts.tradeDate}`;
    const closedAt = moment.tz(bar.key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).add(5, 'minutes');
    const previousClose = _.last(facts.priorDailyCloses);
    const dayChange = previousClose ? `${signed(pct(bar.close, previousClose))}% on the day` : null;
    const fromOpen = facts.openingPrice ? signed(pct(bar.close, facts.openingPrice)) : null;
    const greenAtWinBack = !!previousClose && bar.close > previousClose;
    const green = previousClose && !greenAtWinBack ? turnedGreen(facts, bar.time, previousClose) : null;
    const greenBadges = greenAtWinBack
        ? [greenBadge(previousClose!, bar.close, 'Closed')]
        : green
          ? [greenBadge(previousClose!, green.close, `Turned green later: the ${green.time} candle closed`)]
          : [];
    return [
        {
            id: eventId,
            signal: shine.id,
            eventId,
            stage: 'Back above',
            quote: facts.quote,
            tone: 'opportunity',
            title: `Won back the 5-minute ${slowSmaPeriod} SMA${greenAtWinBack ? ', green on the day' : ''}`,
            summary:
                `Turning ${greenAtWinBack ? 'green' : 'up'}: closed ${bar.close.toFixed(2)} above the ${slowSmaPeriod} SMA (${bandText(slow)}) and the ${fastSmaPeriod} SMA (${fast.toFixed(2)})` +
                `${dayChange ? `, ${dayChange}` : ''}${volumeRatio !== null ? `, candle volume ${volumeRatio.toFixed(1)}× normal` : ''}.`,
            message: `Lost the ${slowSmaPeriod} SMA: ${day.lost!.how}. The ${bar.time} candle closed back above it and the ${fastSmaPeriod} SMA.`,
            details: [
                `Candle ${bar.time}: open ${bar.open.toFixed(2)}, high ${bar.high.toFixed(2)}, low ${bar.low.toFixed(2)}, close ${bar.close.toFixed(2)}`,
                `5-minute ${slowSmaPeriod} SMA ${bandText(slow)} (24-hour chart${slow.high - slow.low >= 0.005 ? ', a range where the overnight is thin' : ''}), ${fastSmaPeriod} SMA ${fast.toFixed(2)}`,
                `Tight and slow: at most ${winBack.dipAtr.toFixed(2)} ATR under the ${slowSmaPeriod} SMA since the bell, a ${winBack.rangeAtr.toFixed(2)} ATR candle back`,
                ...(winBack.slide ? [`Not sliding: ${slideText(winBack.slide)}`] : []),
                ...(fromOpen ? [`${fromOpen}% from the open (${facts.openingPrice!.toFixed(2)})${dayChange ? `, ${dayChange}` : ''}`] : []),
                volumeRatio !== null
                    ? `Candle volume ${Math.round(bar.volume).toLocaleString()}: ${volumeRatio.toFixed(1)}× the same candle on the last ${facts.volumeHistory.length} days`
                    : 'No volume history to compare',
            ],
            candle: closedAt.format('HH:mm'),
            timeIso: closedAt.toISOString(),
            price: bar.close,
            ...(volumeRatio !== null ? { candleVolumeRatio: Math.round(volumeRatio * 100) / 100 } : {}),
            ...(greenBadges.length > 0 ? { badges: greenBadges } : {}),
        },
    ];
};

export const shine: IWatchSignal = {
    id: 'shine',
    title: 'Shine: red to green',
    shortTitle: 'Shine',
    switchable: true,
    refreshesBadges: true,
    describe: () => {
        const {
            windowMinutes,
            ignoreFirstMinutes,
            minLossAtr,
            slowSmaPeriod,
            fastSmaPeriod,
            minCandleVolume,
            maxDipAtr,
            maxTriggerRangeAtr,
            slideHours,
            slideDropAtr,
            slideRecentHours,
            slideFallingHours,
        } = settings();
        return (
            `For days the whole market opens red. Off until you switch it on (the Shine alert button in the header); then it watches every stock, ` +
            `on the board or not. On the 5-minute chart (24-hour, overnight included): a stock that lost the ${slowSmaPeriod} SMA (opened, or a ` +
            `candle since the bell closed, at least ${minLossAtr} ATR under it; closer is sitting on the line) and then closes a 5-minute candle above both the ${slowSmaPeriod} SMA and the ${fastSmaPeriod} SMA ` +
            `(the chart's red line) is turning from red to green: buy setup. It must do it tight and slow with real volume: since the bell never more ` +
            `than ${maxDipAtr} ATR under the ${slowSmaPeriod} SMA, a candle back of at most ${maxTriggerRangeAtr} ATR high to low, and that candle's volume ` +
            `at least ${minCandleVolume}× the same candle on recent days. And not in a clear, steady slide: the hourly 20 SMA must not have ` +
            `fallen ${slideDropAtr} ATR or more over ${slideHours} hours while falling in ${slideFallingHours} or more of the last ${slideRecentHours} hours. ` +
            `Failing one takes the stock out for the day, no alert. ` +
            `Only candles in the first ${windowMinutes} minutes after the bell count, later is too late, and not the first ${ignoreFirstMinutes} minutes ` +
            `(the opening chop): a stock that wins them back that early must lose the ${slowSmaPeriod} SMA again and win it back later. ` +
            `Once per stock per day. Green on the day (above yesterday's close) shows as a badge on the alert, added quietly (no new alert) when it crosses later. ` +
            `Listed as a stack, newest on top; alerts of the same candle are ordered by that candle's volume against normal.`
        );
    },
    watches: (facts) => facts.shineOn,
    detect: (facts) => {
        const day = facts.shineOn ? readDay(facts) : null;
        return day?.winBack && !day.winBack.fault ? alertsOf(facts, day, day.winBack) : [];
    },
    // Only the stocks under the 200 SMA waiting for a close back above, and the ones done for the day: every stock is watched.
    status: (facts) => {
        const day = facts.shineOn ? readDay(facts) : null;
        if (!day?.lost || !day.last) {
            return null;
        }
        const { bar, slow, fast } = day.winBack ?? day.last;
        const { slowSmaPeriod, fastSmaPeriod } = settings();
        const state = day.winBack ? (day.winBack.fault ? `Out: ${day.winBack.fault}` : 'Alerted') : day.windowOver ? 'Too late' : `Under the ${slowSmaPeriod} SMA`;
        return {
            quote: facts.quote,
            signal: shine.id,
            state,
            note: `${bar.time} close ${bar.close.toFixed(2)} (${signed(pct(bar.close, slow.low))}% from the ${slowSmaPeriod} SMA ${bandText(slow)}, ${fastSmaPeriod} SMA ${fast.toFixed(2)})`,
        };
    },
};
