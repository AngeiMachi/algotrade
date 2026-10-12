import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../../../config/globals.config';
import { MarketWatchConfig } from '../../../config/market-watch.config';
import { RaceRulesConfig } from '../../../config/race-rules.config';
import { decisionBadges } from '../alert-badges';
import { anglePart, scoreOf, volumePart } from '../alert-score';
import { healthyPremarket, inUptrend, priorSmaSlopeAtr, smaAtHour, smaSlopeAtrAtHour } from '../hourly-sma';
import { IMarketAlert, IWatchBar, IWatchFacts, IWatchSignal } from '../market-watch.types';
import { opensAboveBand } from './upper-band-touch';

// The trader's setup: an hourly candle dips under the rising hourly 20 SMA, is bought back and closes above it.
// A stock that keeps respecting the 20 SMA like that in the first hours of the session tends to go up.
// Only a hammer or a cross on the SMA counts: a real dip under it, a close just above it, and long wicks showing the
// fight (a small full-body candle says nothing). Stages of one hourly candle: Forming (at hh:55, so far) →
// Closed above (buy), No setup, or Lost it. A low less than minDipAtr under the SMA is no touch: nothing is listed.

const NEW_YORK = 'America/New_York';
const settings = () => MarketWatchConfig.smaReclaim;
const period = () => globalConfig.PremarketRace.smaPeriod;

// On the board or healthy pre-market, and in the daily uptrend.
const eligible = (facts: IWatchFacts) => facts.openingPrice !== null && (facts.onBoard || healthyPremarket(facts) === true) && inUptrend(facts);

// Out for the day: the hourly 20 SMA pointed down yesterday, unless the stock opened above the daily upper band.
const pointedDownYesterday = (facts: IWatchFacts): number | null => {
    const priorSlope = priorSmaSlopeAtr(facts);
    return priorSlope !== null && priorSlope < RaceRulesConfig.minPriorSmaSlopeAtr && !opensAboveBand(facts) ? priorSlope : null;
};

interface IHourReading {
    hour: string;
    bar: IWatchBar; // the last closed 5-minute candle read
    low: number; // the hour's low so far
    high: number;
    close: number; // the hour's close so far
    sma: number;
    slopeAtr: number;
    dipAtr: number; // how far the low went under the SMA, in daily ATRs
    closeAboveAtr: number; // how far the close is above the SMA, in daily ATRs
    rangeAtr: number; // the hour's high to low, in daily ATRs: how hard they fought
    bodyShare: number; // the body (open to close) as a share of that range: small = mostly wicks
}

// The hourly candle as it stood once its 5-minute candles up to `untilMinute` closed. Null if they have not.
const readHour = (facts: IWatchFacts, hour: string, untilMinute: number): IHourReading | null => {
    const lastTime = `${hour}:${String(untilMinute - 5).padStart(2, '0')}`;
    const hourBars = facts.allBars.filter((bar) => bar.time.startsWith(`${hour}:`) && bar.time <= lastTime);
    const bar = _.last(hourBars);
    if (!bar || bar.time !== lastTime || bar.forming) {
        return null;
    }
    const close = bar.close;
    const sma = smaAtHour(facts, period(), hour, close);
    const slopeAtr = smaSlopeAtrAtHour(facts, hour, close);
    if (sma === null || slopeAtr === null) {
        return null;
    }
    const low = _.minBy(hourBars, 'low')!.low;
    const high = _.maxBy(hourBars, 'high')!.high;
    const open = hourBars[0].open;
    const atr = ((facts.atrPct > 0 ? facts.atrPct : RaceRulesConfig.fallbackAtrPct) / 100) * sma;
    return {
        hour,
        bar,
        low,
        high,
        close,
        sma,
        slopeAtr,
        dipAtr: (sma - low) / atr,
        closeAboveAtr: (close - sma) / atr,
        rangeAtr: (high - low) / atr,
        bodyShare: high > low ? Math.abs(close - open) / (high - low) : 1,
    };
};

const dippedAndBack = (reading: IHourReading) => reading.low < reading.sma && reading.close > reading.sma;
const pointsUp = (reading: IHourReading) => reading.slopeAtr >= settings().minSlopeAtr;
// Why a reclaim is not the setup (a real dip, a close just above the SMA, a fight with long wicks); null when it is.
const shapeFault = (reading: IHourReading): string | null => {
    const { minDipAtr, maxCloseAboveAtr, minRangeAtr, maxBodyShare } = settings();
    if (reading.closeAboveAtr > maxCloseAboveAtr) {
        return `too far above the SMA (${reading.closeAboveAtr.toFixed(2)} ATR, max ${maxCloseAboveAtr})`;
    }
    if (reading.dipAtr < minDipAtr) {
        return `only ticked under (${reading.dipAtr.toFixed(2)} ATR, min ${minDipAtr})`;
    }
    if (reading.rangeAtr < minRangeAtr) {
        return `no fight (range ${reading.rangeAtr.toFixed(2)} ATR, min ${minRangeAtr})`;
    }
    if (reading.bodyShare > maxBodyShare) {
        return `full body (${Math.round(reading.bodyShare * 100)}%, max ${Math.round(maxBodyShare * 100)}%)`;
    }
    return null;
};

// The name the trader would give the candle.
const candleName = (reading: IHourReading) => (reading.bodyShare <= 0.15 ? 'a cross' : reading.bodyShare <= settings().maxBodyShare ? 'a hammer' : 'a full-body candle');
const pct = (from: number, to: number) => ((from - to) / to) * 100;

const scoreReading = (facts: IWatchFacts, reading: IHourReading) => {
    const { maxCloseAboveAtr } = settings();
    const { fullDipAtr, closenessWeight, minFactor } = settings().score;
    const badges = decisionBadges(facts, {
        price: reading.close,
        stop: reading.low,
        until: reading.bar.time,
        slopeAtr: reading.slopeAtr,
        dipAtr: reading.dipAtr,
    });
    return {
        badges,
        ...scoreOf([
            anglePart(reading.slopeAtr),
            {
                label: 'Dip under the SMA',
                factor: 0.5 + 0.5 * _.clamp(reading.dipAtr / fullDipAtr, 0, 1),
                note: `${reading.dipAtr.toFixed(2)} ATR under`,
            },
            {
                label: 'Close to the SMA',
                factor: Math.max(minFactor, 1 - (closenessWeight * Math.max(0, reading.closeAboveAtr)) / maxCloseAboveAtr),
                note: `${reading.closeAboveAtr.toFixed(2)} ATR above`,
            },
            volumePart(facts, reading.bar.time),
        ]),
    };
};

// Out of the game for the day: an earlier watched hourly candle closed under the 20 SMA (HPE Oct 9: the 09:00 candle
// closed at 71.40 under 71.84, so its 10:00 reclaim does not count).
const closedUnderEarlier = (facts: IWatchFacts, hour: string): IHourReading | null => {
    for (const earlier of settings().hours.filter((watched) => watched < hour)) {
        const reading = readHour(facts, earlier, 60);
        if (reading && reading.close < reading.sma) {
            return reading;
        }
    }
    return null;
};
const hourLabel = (hour: string) => `${hour}:00–${String(Number(hour) + 1).padStart(2, '0')}:00`;

const readingLines = (reading: IHourReading) => [
    `Hourly 20 SMA ${reading.sma.toFixed(2)}, rising ${reading.slopeAtr.toFixed(2)} ATR over the last ${RaceRulesConfig.scoring.smaSlope.lookbackHours} hours`,
    `Low ${reading.low.toFixed(2)} (${pct(reading.low, reading.sma).toFixed(2)}% under the SMA), now ${reading.close.toFixed(2)} (${pct(reading.close, reading.sma) >= 0 ? '+' : ''}${pct(reading.close, reading.sma).toFixed(2)}%)`,
    `Shape: dip ${reading.dipAtr.toFixed(2)} ATR under, close ${reading.closeAboveAtr.toFixed(2)} ATR above`,
    `Candle: ${candleName(reading)}, ${reading.rangeAtr.toFixed(2)} ATR high to low, body ${Math.round(reading.bodyShare * 100)}% of it`,
];

const alertOf = (facts: IWatchFacts, reading: IHourReading, stage: 'forming' | 'closed' | 'lost' | 'misshapen'): IMarketAlert => {
    const eventId = `sma-reclaim:${facts.quote}:${facts.tradeDate}:${reading.hour}`;
    // Stamped when the reading is complete (the 5-minute candle's close), the moment the alert is due.
    const readAt = moment.tz(reading.bar.key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).add(5, 'minutes');
    const base = {
        signal: smaReclaim.id,
        eventId,
        quote: facts.quote,
        details: [...readingLines(reading), `Hourly candle ${hourLabel(reading.hour)} New York`],
        candle: readAt.format('HH:mm'),
        timeIso: readAt.toISOString(),
        price: reading.close,
    };
    if (stage === 'forming') {
        return {
            ...base,
            ...scoreReading(facts, reading),
            id: `${eventId}:forming`,
            stage: 'Forming',
            tone: 'prepare',
            title: 'Reclaiming the hourly 20 SMA',
            summary: `Back above the 20 SMA (${reading.sma.toFixed(2)}) after a dip to ${reading.low.toFixed(2)}. Hourly close in 5 min.`,
            message: `Get ready.`,
        };
    }
    if (stage === 'closed') {
        return {
            ...base,
            ...scoreReading(facts, reading),
            id: `${eventId}:closed`,
            stage: 'Closed above',
            tone: 'opportunity',
            title: 'Reclaimed the hourly 20 SMA',
            summary: `Buy: ${candleName(reading)} on the 20 SMA, closed ${reading.close.toFixed(2)}. Stop under ${reading.low.toFixed(2)}.`,
            message: `Buy: ${candleName(reading)} on the 20 SMA (${reading.sma.toFixed(2)}).`,
        };
    }
    if (stage === 'misshapen') {
        return {
            ...base,
            ...scoreReading(facts, reading),
            id: `${eventId}:misshapen`,
            stage: 'No setup',
            tone: 'info',
            title: 'Closed above the hourly 20 SMA, not the setup',
            summary: `No buy: ${shapeFault(reading)}.`,
            message: `Needs a hammer or a cross on the SMA.`,
        };
    }
    return {
        ...base,
        id: `${eventId}:lost`,
        stage: 'Lost it',
        tone: 'caution',
        title: 'Closed under the hourly 20 SMA',
        summary: `Failed: closed ${reading.close.toFixed(2)}, under the 20 SMA (${reading.sma.toFixed(2)}).`,
        message: `Out for the day.`,
    };
};

export const smaReclaim: IWatchSignal = {
    id: 'sma-reclaim',
    title: 'Reclaim of the hourly 20 SMA',
    shortTitle: '20 SMA reclaim',
    describe: () => {
        const { hours, prepareAtMinute, minSlopeAtr, minDipAtr, maxCloseAboveAtr, minRangeAtr, maxBodyShare } = settings();
        return (
            `Watches stocks on the board or healthy pre-market (no pre-market hourly close through the 20 SMA) that are in the daily uptrend. ` +
            `A stock whose hourly 20 SMA pointed down yesterday is out, unless it opened above the daily upper Bollinger band (a big jump, like earnings). ` +
            `In the hourly candles ${hours.map(hourLabel).join(' and ')} New York (nothing before 10:00), when the candle dips under the hourly 20 SMA ` +
            `and buyers take it back while the SMA rises at least ${minSlopeAtr} ATR over 10 hours. The low must go at least ` +
            `${minDipAtr} ATR under it and the close be at most ${maxCloseAboveAtr} ATR above it, and the candle must show a fight: ` +
            `a hammer or a cross, at least ${minRangeAtr} ATR from high to low with the body at most ${Math.round(maxBodyShare * 100)}% of it. ` +
            `"Get ready" at :${prepareAtMinute} if it is like that, "Buy setup" (popup and chime) when the hourly candle closes like that; ` +
            `closed above but too far, or a quiet or full-body candle is a quiet "Wait"; a low less than ${minDipAtr} ATR under the SMA never touched it and is not listed. ` +
            `Can trigger in each of those hours, but once an hourly candle ` +
            `has closed under the SMA the stock is out for the day. ` +
            `Score = 100 × angle of the SMA × depth of the dip × closeness of the close to the SMA ` +
            `× volume against normal for the time of day (quiet lowers it, busy lifts it); a stock that does it in both hours adds the two scores.`
        );
    },
    watches: eligible,
    detect: (facts) => {
        if (!eligible(facts) || pointedDownYesterday(facts) !== null) {
            return [];
        }
        return _.flatMap(settings().hours, (hour) => {
            if (closedUnderEarlier(facts, hour)) {
                return [];
            }
            const atPrepare = readHour(facts, hour, settings().prepareAtMinute);
            const atClose = readHour(facts, hour, 60);
            const preparing = !!atPrepare && dippedAndBack(atPrepare) && pointsUp(atPrepare) && shapeFault(atPrepare) === null;
            const alerts: IMarketAlert[] = [];
            if (preparing) {
                alerts.push(alertOf(facts, atPrepare!, 'forming'));
            }
            if (atClose && atClose.dipAtr >= settings().minDipAtr && pointsUp(atClose)) {
                if (atClose.close > atClose.sma) {
                    alerts.push(alertOf(facts, atClose, shapeFault(atClose) === null ? 'closed' : 'misshapen'));
                } else if (preparing) {
                    alerts.push(alertOf(facts, atClose, 'lost'));
                }
            }
            return alerts;
        });
    },
    status: (facts) => {
        if (!eligible(facts)) {
            return null;
        }
        const last = _.last(facts.allBars);
        if (!last) {
            return null;
        }
        const hour = last.time.substring(0, 2);
        const sma = smaAtHour(facts, period(), hour, last.close);
        const slopeAtr = smaSlopeAtrAtHour(facts, hour, last.close);
        if (sma === null || slopeAtr === null) {
            return null;
        }
        const { hours } = settings();
        const done = hour > _.last(hours)!;
        const downYesterday = pointedDownYesterday(facts);
        const out = done ? null : closedUnderEarlier(facts, hour);
        const state = done
            ? 'Done for today'
            : downYesterday !== null
              ? `Out: the 20 SMA pointed down yesterday (${downYesterday.toFixed(2)} ATR)`
              : out
                ? `Out: the ${out.hour}:00 candle closed under`
                : slopeAtr >= settings().minSlopeAtr
                  ? 'Watching'
                  : 'SMA flat';
        return {
            quote: facts.quote,
            signal: smaReclaim.id,
            state,
            note: `${pct(last.close, sma) >= 0 ? '+' : ''}${pct(last.close, sma).toFixed(2)}% from the 20 SMA (${sma.toFixed(2)}), angle ${slopeAtr >= 0 ? '+' : ''}${slopeAtr.toFixed(2)} ATR`,
        };
    },
};
