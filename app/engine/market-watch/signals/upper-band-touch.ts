import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../../../config/globals.config';
import { MarketWatchConfig } from '../../../config/market-watch.config';
import { RaceRulesConfig } from '../../../config/race-rules.config';
import { dailyBollingerBand } from '../../race-rules/race-facts';
import { IMarketAlert, IWatchBar, IWatchFacts, IWatchSignal } from '../market-watch.types';

// A stock that opened above the daily upper Bollinger band comes back down to it during the session.
// What matters is how it got there (the trader's observation):
//   - fast: it fell to the band in a few candles (1 to 4, sometimes more, but quickly) → it tends to jump back up.
//   - slow: it slid down candle after candle (~10) and arrived gently → it tends to keep sliding through.
// The band moves with the price, as on the live daily chart: the last 19 daily closes plus the price as today's close.

const NEW_YORK = 'America/New_York';
// "Near the high" for counting how long the descent took: within the top fifth of the way down.
const NEAR_TOP_SHARE = 0.8;

export type TouchVerdict = 'fast' | 'slow' | 'heavy' | 'opening' | 'unclear';

export interface IBandTouch {
    index: number; // the touch candle in facts.bars
    bar: IWatchBar;
    level: number; // the price where the candle met the band
    top: number; // highest price since the stock was armed
    dropAtr: number; // top → level, in daily ATRs
    recentDropAtr: number; // the fall over the last `recentCandles` candles, in daily ATRs
    recentShare: number; // recentDropAtr ÷ dropAtr: how much of the way down came at the end
    descentCandles: number; // candles since the price was last near the top
    lowerHighShare: number; // share of those candles that made a lower high (a staircase down)
    volumeRatio: number | null; // volume of the recent candles vs the session's median candle before them
    minutesFromOpen: number; // when the touch candle started, after the bell
    meaningful: boolean; // the price had been far enough above the band (else it was hugging it)
    verdict: TouchVerdict;
}

const settings = () => MarketWatchConfig.upperBandTouch;

const bandAt = (facts: IWatchFacts, price: number) => dailyBollingerBand(facts.priorDailyCloses, price, 'long') as number;
// How far the price is above the band drawn with that price as today's close, in daily ATRs (negative = under it).
const atrAboveBand = (facts: IWatchFacts, price: number) => ((price - bandAt(facts, price)) / price) * 100 / facts.atrPct;
const toAtr = (facts: IWatchFacts, from: number, to: number) => ((from - to) / to) * 100 / facts.atrPct;

// The price where the band was met inside a candle that went from `above` down to `low`. The gap to the band shrinks
// steadily as the price falls (the band follows the price at only ~1/4 its speed), so halving the range finds it.
const touchLevel = (facts: IWatchFacts, above: number, low: number): number => {
    if (atrAboveBand(facts, above) <= 0) {
        return above;
    }
    let [high, lowBound] = [above, low];
    for (let step = 0; step < 40; step++) {
        const middle = (high + lowBound) / 2;
        if (atrAboveBand(facts, middle) > 0) {
            high = middle;
        } else {
            lowBound = middle;
        }
    }
    return (high + lowBound) / 2;
};

const opensAboveBand = (facts: IWatchFacts) =>
    facts.openingPrice !== null && facts.priorDailyCloses.length >= RaceRulesConfig.bollinger.periodDays - 1 && atrAboveBand(facts, facts.openingPrice) > 0;

// Every touch of the day so far. Armed at the open; after a touch it re-arms once a closed candle is far enough above.
export const findBandTouches = (facts: IWatchFacts): IBandTouch[] => scanBand(facts).touches;

const scanBand = (facts: IWatchFacts): { touches: IBandTouch[]; armed: boolean } => {
    if (!opensAboveBand(facts) || facts.atrPct <= 0) {
        return { touches: [], armed: false };
    }
    const { bars } = facts;
    const touches: IBandTouch[] = [];
    let armedAt: number | null = 0;
    let top = facts.openingPrice as number;

    bars.forEach((bar, index) => {
        if (armedAt === null) {
            if (!bar.forming && atrAboveBand(facts, bar.close) >= settings().rearmAtr) {
                armedAt = index;
                top = bar.high;
            }
            return;
        }
        if (atrAboveBand(facts, bar.low) > 0) {
            top = Math.max(top, bar.high);
            return;
        }
        touches.push(describeTouch(facts, index, armedAt, Math.max(top, bar.open)));
        armedAt = null;
    });
    return { touches, armed: armedAt !== null };
};

const describeTouch = (facts: IWatchFacts, index: number, armedAt: number, top: number): IBandTouch => {
    const { bars } = facts;
    const bar = bars[index];
    const { recentCandles, minExcursionAtr } = settings();
    const level = touchLevel(facts, index > 0 ? Math.max(bar.open, bars[index - 1].close) : bar.open, bar.low);

    const recentBars = bars.slice(Math.max(armedAt, index - recentCandles + 1), index);
    const recentTop = Math.max(bar.open, ...recentBars.map((recent) => recent.high));
    const dropAtr = toAtr(facts, top, level);
    const recentDropAtr = toAtr(facts, Math.min(recentTop, top), level);

    const nearTop = level + NEAR_TOP_SHARE * (top - level);
    const lastNearTop = _.findLastIndex(bars, (candidate, position) => position >= armedAt && position < index && candidate.high >= nearTop);
    const descentStart = bar.open >= nearTop || lastNearTop < 0 ? index : lastNearTop;
    const descentCandles = Math.max(1, index - descentStart);
    const descent = bars.slice(descentStart, index + 1);
    const lowerHighs = descent.slice(1).filter((candle, position) => candle.high < descent[position].high).length;

    const before = bars.slice(0, Math.max(0, index - recentCandles + 1));
    const volumeRatio = before.length >= 6 ? _.meanBy([...recentBars, bar], 'volume') / median(before.map((candle) => candle.volume)) : null;

    const touch = {
        index,
        bar,
        level,
        top,
        dropAtr,
        recentDropAtr,
        recentShare: dropAtr > 0 ? recentDropAtr / dropAtr : 1,
        descentCandles,
        lowerHighShare: descent.length > 1 ? lowerHighs / (descent.length - 1) : 0,
        volumeRatio,
        minutesFromOpen: index * 5,
        meaningful: dropAtr >= minExcursionAtr,
        verdict: 'unclear' as TouchVerdict,
    };
    touch.verdict = judge(touch);
    return touch;
};

// Order matters: heavy selling outweighs speed, and a fast drop only counts in the bounce window.
export const judge = (touch: Pick<IBandTouch, 'recentDropAtr' | 'recentShare' | 'descentCandles' | 'minutesFromOpen' | 'volumeRatio'>): TouchVerdict => {
    const { fastDropAtr, fastShare, fastFromMinute, fastUntilMinute, heavyVolumeRatio, slideMinCandles, slideMaxRecentDropAtr } = settings();
    if (touch.volumeRatio !== null && touch.volumeRatio >= heavyVolumeRatio) {
        return 'heavy';
    }
    if (touch.minutesFromOpen < fastFromMinute) {
        return 'opening';
    }
    if (touch.recentDropAtr >= fastDropAtr && touch.recentShare >= fastShare && touch.minutesFromOpen < fastUntilMinute) {
        return 'fast';
    }
    if (touch.descentCandles >= slideMinCandles && touch.recentDropAtr < slideMaxRecentDropAtr) {
        return 'slow';
    }
    return 'unclear';
};

const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 || 1;
};

// Slow slides and heavy selling are avoided whatever happens next; the others wait for the band to hold.
const VERDICT_TEXT: { [verdict in TouchVerdict]: { avoid: boolean; title: string; outlook: string } } = {
    fast: { avoid: false, title: 'Fast drop to the upper BB', outlook: 'Fell fast into the band: it often jumps, but bought right at the touch it fails as often as it works.' },
    slow: { avoid: true, title: 'Slow slide to the upper BB', outlook: 'Slid slowly into the band: tends to keep sliding through it.' },
    heavy: { avoid: true, title: 'Heavy selling into the upper BB', outlook: 'Heavy volume on the way down is real selling: rarely bounced.' },
    opening: { avoid: false, title: 'Opening dip to the upper BB', outlook: 'First 15 minutes after the bell: opening chop.' },
    unclear: { avoid: false, title: 'Touched the upper BB', outlook: 'Neither a fast drop nor a slow slide.' },
};

const candles = (count: number) => `${count} ${count === 1 ? 'candle' : 'candles'}`;
const timeIsoOf = (bar: IWatchBar) => moment.tz(bar.key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).toISOString();
const atrUnit = (facts: IWatchFacts, price: number) => (price * facts.atrPct) / 100;

// The hourly SMA at a candle: hourly closes completed before it, with `price` as the current hour's close.
const hourlySmaAt = (facts: IWatchFacts, period: number, bar: IWatchBar, price: number): number | null => {
    const hoursDone = facts.hours.filter((hour) => Number(hour.hour) + 1 <= Number(bar.time.substring(0, 2)));
    const closes = [...facts.priorHourlyCloses, ...hoursDone.map((hour) => hour.close), price];
    return closes.length >= period ? _.mean(_.takeRight(closes, period)) : null;
};

// Healthy before the bell, the race's rule: no pre-market hourly candle closed through the hourly 20 SMA.
const healthyPremarket = (facts: IWatchFacts): boolean | null => {
    const period = globalConfig.PremarketRace.smaPeriod;
    const premarket = facts.hours.filter((hour) => hour.hour < '09' && hour.complete);
    if (facts.priorHourlyCloses.length < period || premarket.length === 0) {
        return null;
    }
    const closes = [...facts.priorHourlyCloses];
    return premarket.every((hour) => {
        closes.push(hour.close);
        const sma = _.mean(_.takeRight(closes, period));
        return ((hour.close - sma) / sma) * 100 >= -RaceRulesConfig.smaTolerancePct;
    });
};

interface ITouchHealth {
    healthy: boolean | null; // pre-market, with the hourly 20 SMA
    trendSma: number | null; // the hourly 50 SMA at the touch
    aboveTrend: boolean | null;
}

const healthAt = (facts: IWatchFacts, touch: IBandTouch): ITouchHealth => {
    const trendSma = hourlySmaAt(facts, settings().trendSmaPeriod, touch.bar, touch.level);
    return { healthy: healthyPremarket(facts), trendSma, aboveTrend: trendSma === null ? null : touch.level > trendSma };
};

const healthLines = (health: ITouchHealth) => [
    health.healthy === null
        ? 'Pre-market health with the hourly 20 SMA unknown'
        : health.healthy
        ? 'Healthy pre-market: no hourly close through the 20 SMA'
        : 'Not healthy pre-market: an hourly candle closed through the 20 SMA',
    health.trendSma === null
        ? `Hourly ${settings().trendSmaPeriod} SMA unknown`
        : `${health.aboveTrend ? 'Above' : 'Under'} the hourly ${settings().trendSmaPeriod} SMA (${health.trendSma.toFixed(2)}) at the touch`,
];

const touchAlert = (facts: IWatchFacts, touch: IBandTouch, health: ITouchHealth): IMarketAlert => {
    const text = VERDICT_TEXT[touch.verdict];
    const { recentCandles, trendSmaPeriod } = settings();
    const underTrend = health.aboveTrend === false;
    return {
        id: `upper-band-touch:${facts.quote}:${touch.bar.key}`,
        signal: upperBandTouch.id,
        quote: facts.quote,
        tone: text.avoid || underTrend ? 'caution' : 'info',
        title: text.title,
        summary: text.avoid
            ? text.outlook
            : underTrend
            ? `Under the hourly ${trendSmaPeriod} SMA: the weakest touches, avoid.`
            : `${text.outlook} Wait for a 5-minute close back above ${touch.level.toFixed(2)} before buying.`,
        message: `Came down to the daily upper BB at ${touch.level.toFixed(2)}: ${touch.dropAtr.toFixed(2)} ATR from its high in ${candles(touch.descentCandles)}.`,
        details: [
            `Fell ${touch.recentDropAtr.toFixed(2)} ATR in the last ${candles(Math.min(recentCandles, touch.index + 1))} (${Math.round(touch.recentShare * 100)}% of the way down)`,
            `High since the open or last re-arm ${touch.top.toFixed(2)}; ${Math.round(touch.lowerHighShare * 100)}% of the descent candles made a lower high`,
            touch.volumeRatio === null ? 'Too early in the session to compare volume' : `Volume on the way down ${touch.volumeRatio.toFixed(1)}× a typical candle today`,
            ...healthLines(health),
        ],
        candle: touch.bar.time,
        timeIso: timeIsoOf(touch.bar),
        price: touch.level,
    };
};

// The buy setup: a healthy stock above the hourly 50 SMA, not sliding or sold heavily, whose 5-minute candle closes
// back above the touch within half an hour, before any close under the stop.
const heldAlert = (facts: IWatchFacts, touch: IBandTouch, health: ITouchHealth): IMarketAlert | null => {
    const { confirmWithinCandles, stopAtr, targetMinAtr, breakevenAfterAtr } = settings();
    if (VERDICT_TEXT[touch.verdict].avoid || health.healthy !== true || health.aboveTrend !== true) {
        return null;
    }
    const unit = atrUnit(facts, touch.level);
    const stop = touch.level - stopAtr * unit;
    const window = facts.bars.slice(touch.index + 1, touch.index + 1 + confirmWithinCandles).filter((bar) => !bar.forming);
    const brokeAt = window.findIndex((bar) => bar.close < stop);
    const heldAt = window.findIndex((bar) => bar.close > touch.level);
    if (heldAt < 0 || (brokeAt >= 0 && brokeAt < heldAt)) {
        return null;
    }
    const bar = window[heldAt];
    const target = Math.max(touch.level + 0.5 * (touch.top - touch.level), bar.close + targetMinAtr * unit);
    return {
        id: `upper-band-touch:${facts.quote}:${touch.bar.key}:held`,
        signal: upperBandTouch.id,
        quote: facts.quote,
        tone: 'opportunity',
        title: 'Held the upper BB',
        summary: `Buy setup: target ${target.toFixed(2)}, bail on a 5-minute close under ${stop.toFixed(2)}, out at your price if it bounces and comes back.`,
        message: `Touched the band at ${touch.level.toFixed(2)} at ${touch.bar.time} and closed back above it at ${bar.close.toFixed(2)}.`,
        details: [
            `Target: halfway back to the high ${touch.top.toFixed(2)}, at least ${targetMinAtr} ATR (${(target - bar.close).toFixed(2)} above)`,
            `Stop: a 5-minute close ${stopAtr} ATR under the band. Break-even once it bounced ${breakevenAfterAtr} ATR (${(bar.close + breakevenAfterAtr * unit).toFixed(2)})`,
            `How it came down: ${VERDICT_TEXT[touch.verdict].title.toLowerCase()}`,
            ...healthLines(health),
            'Past year, 30 big stocks: 31% hit the target, 29% break-even, 15% stopped, the rest still open after 2 hours',
        ],
        candle: bar.time,
        timeIso: timeIsoOf(bar),
        price: bar.close,
    };
};

export const upperBandTouch: IWatchSignal = {
    id: 'upper-band-touch',
    title: 'Back to the upper Bollinger band',
    describe: () => {
        const { slideMinCandles, heavyVolumeRatio, minExcursionAtr, rearmAtr, confirmWithinCandles, stopAtr, targetMinAtr, breakevenAfterAtr, trendSmaPeriod } =
            settings();
        return (
            `Watches every stock that opened above the daily upper Bollinger band and notes each time the price comes back down to it ` +
            `(after being at least ${minExcursionAtr} ATR above). Avoid: a slow slide (${slideMinCandles}+ candles down, arriving gently), heavy selling ` +
            `(${heavyVolumeRatio}× a typical candle's volume) or a touch under the hourly ${trendSmaPeriod} SMA. ` +
            `Buy setup (popup and chime): a stock healthy with the hourly 20 SMA pre-market and above the hourly ${trendSmaPeriod} SMA whose 5-minute candle ` +
            `closes back above the band within ${confirmWithinCandles * 5} minutes. Target halfway back to the high (at least ${targetMinAtr} ATR), out on a ` +
            `5-minute close ${stopAtr} ATR under the band, break-even after a ${breakevenAfterAtr} ATR bounce. Re-arms after a candle closes ${rearmAtr} ATR above the band.`
        );
    },
    watches: opensAboveBand,
    detect: (facts) =>
        _.flatMap(
            findBandTouches(facts).filter((touch) => touch.meaningful),
            (touch) => {
                const health = healthAt(facts, touch);
                return _.compact([touchAlert(facts, touch, health), heldAlert(facts, touch, health)]);
            }
        ),
    status: (facts) => {
        if (!opensAboveBand(facts)) {
            return null;
        }
        const last = _.last(facts.bars);
        const price = last ? last.close : (facts.openingPrice as number);
        const distance = atrAboveBand(facts, price);
        const { touches, armed } = scanBand(facts);
        return {
            quote: facts.quote,
            signal: upperBandTouch.id,
            state: armed ? 'Armed' : `Touched ${touches.length}×`,
            note:
                `${distance >= 0 ? `${distance.toFixed(2)} ATR above` : `${(-distance).toFixed(2)} ATR below`} the BB (${bandAt(facts, price).toFixed(2)})` +
                (armed ? '' : ` · re-arms at +${settings().rearmAtr}`),
        };
    },
};
