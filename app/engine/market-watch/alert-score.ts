import * as _ from 'lodash';
import moment from 'moment-timezone';

import { MarketWatchConfig } from '../../config/market-watch.config';
import { RaceRulesConfig } from '../../config/race-rules.config';
import { IAlertScorePart, IWatchFacts } from './market-watch.types';

// Rates a setup like the race scores a stock: 100 × factors, each with a plain note. Most factors are between 0 and 1;
// volume can also lift the score (busier than normal) up to volume.maxFactor.

export const scoreOf = (parts: IAlertScorePart[]) => ({
    score: Math.round(100 * parts.reduce((product, part) => product * part.factor, 1) * 10) / 10,
    scoreParts: parts,
});

// The race's angle factor (scoring.smaSlope): rising 0.3 ATR or more ~1, 0.2 → 0.91, 0.1 → 0.63, flat 0.34.
export const anglePart = (slopeAtr: number): IAlertScorePart => {
    const { midpointAtr, widthAtr, floor } = RaceRulesConfig.scoring.smaSlope;
    const rising = (1 + Math.tanh((slopeAtr - midpointAtr) / widthAtr)) / 2;
    return {
        label: 'Angle of the 20 SMA',
        factor: floor + (1 - floor) * rising,
        note: `${slopeAtr >= 0 ? '+' : ''}${slopeAtr.toFixed(2)} ATR over ${RaceRulesConfig.scoring.smaSlope.lookbackHours}h`,
    };
};

// Today's volume from 04:00 through the candle starting at `until` ('HH:mm'), against the average of recent sessions
// up to the same time (RVOL). The same ratio projects the day: 2× by 10:00 is on pace for about twice a normal day.
export const relativeVolumeAt = (facts: IWatchFacts, until: string): number | null => {
    if (facts.volumeHistory.length < MarketWatchConfig.volume.minDays) {
        return null;
    }
    const today = _.sumBy(
        facts.allBars.filter((bar) => bar.time <= until),
        'volume'
    );
    const typical = _.meanBy(facts.volumeHistory, (day) => _.sumBy(day.bars.filter((bar) => bar.time <= until), 'volume'));
    return typical > 0 ? today / typical : null;
};

// Volume in the 5-minute candles starting after `from` and up to `until` ('HH:mm'), today against the recent sessions.
const relativeVolumeBetween = (facts: IWatchFacts, from: string, until: string): number | null => {
    if (facts.volumeHistory.length < MarketWatchConfig.volume.minDays) {
        return null;
    }
    const inWindow = (bar: { time: string }) => bar.time > from && bar.time <= until;
    const today = _.sumBy(facts.allBars.filter(inWindow), 'volume');
    const typical = _.meanBy(facts.volumeHistory, (day) => _.sumBy(day.bars.filter(inWindow), 'volume'));
    return typical > 0 ? today / typical : null;
};

// One 5-minute candle's volume ('HH:mm' start) against the same candle in the recent sessions.
export const candleRelativeVolume = (facts: IWatchFacts, time: string): number | null => {
    const bar = facts.allBars.find((candidate) => candidate.time === time);
    if (!bar || facts.volumeHistory.length < MarketWatchConfig.volume.minDays) {
        return null;
    }
    const typical = _.meanBy(facts.volumeHistory, (day) => day.bars.find((candidate) => candidate.time === time)?.volume ?? 0);
    return typical > 0 ? bar.volume / typical : null;
};

export interface IVolumeNow {
    until: string; // the last closed 5-minute candle read
    rvol: number; // the day so far against normal
    pace: number | null; // the last window against normal for those minutes
    trend: 'rising' | 'steady' | 'fading' | null;
}

// The stock's volume as of its last closed candle: the day's RVOL and whether the pace is picking up or fading.
export const volumeNow = (facts: IWatchFacts): IVolumeNow | null => {
    const last = _.findLast(facts.allBars, (bar) => !bar.forming);
    const rvol = last ? relativeVolumeAt(facts, last.time) : null;
    if (!last || rvol === null) {
        return null;
    }
    const { trendWindowMinutes, risingRatio, fadingRatio } = MarketWatchConfig.volume;
    const minus = (minutes: number) => moment(last.time, 'HH:mm').subtract(minutes, 'minutes').format('HH:mm');
    const pace = relativeVolumeBetween(facts, minus(trendWindowMinutes), last.time);
    const before = relativeVolumeBetween(facts, minus(2 * trendWindowMinutes), minus(trendWindowMinutes));
    const change = pace !== null && before ? pace / before : null;
    const trend = change === null ? null : change >= risingRatio ? 'rising' : change <= fadingRatio ? 'fading' : 'steady';
    return { until: last.time, rvol, pace, trend };
};

export const volumePart = (facts: IWatchFacts, until: string): IAlertScorePart => {
    const rvol = relativeVolumeAt(facts, until);
    if (rvol === null) {
        return { label: 'Volume', factor: 1, note: 'No volume history to compare' };
    }
    const { exponent, minFactor, maxFactor } = MarketWatchConfig.volume;
    return {
        label: 'Volume',
        factor: _.clamp(rvol ** exponent, minFactor, maxFactor),
        note: `${rvol.toFixed(1)}× a normal day's volume by ${until} (${facts.volumeHistory.length}-day average)`,
    };
};
