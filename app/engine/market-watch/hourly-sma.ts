import * as _ from 'lodash';

import * as globalConfig from '../../config/globals.config';
import { RaceRulesConfig } from '../../config/race-rules.config';
import { dailyTrend, smaChangePct } from '../race-rules/race-facts';
import { IWatchBar, IWatchFacts } from './market-watch.types';

// The hourly SMAs on the race's 24-hour chart, read the way the race reads them, for the signals.

// Hourly closes before `hour` ('HH', today): yesterday's and earlier, then today's completed hours.
const closesBefore = (facts: IWatchFacts, hour: string) => [
    ...facts.priorHourlyCloses,
    ...facts.hours.filter((candle) => candle.hour < hour).map((candle) => candle.close),
];

// The SMA as the chart draws it at `hour`'s candle, with `close` as that candle's close.
export const smaAtHour = (facts: IWatchFacts, period: number, hour: string, close: number): number | null => {
    const closes = [...closesBefore(facts, hour), close];
    return closes.length >= period ? _.mean(_.takeRight(closes, period)) : null;
};

// The SMA at each of the last `hours` hourly candles before `hour` and at `hour` itself (`close` as its close), oldest
// first; null without enough closes.
export const smaPathAtHour = (facts: IWatchFacts, period: number, hour: string, close: number, hours: number): number[] | null => {
    const closes = [...closesBefore(facts, hour), close];
    if (closes.length < period + hours) {
        return null;
    }
    return _.range(hours, -1, -1).map((back) => _.mean(closes.slice(closes.length - back - period, closes.length - back)));
};

// The race's angle of the hourly 20 SMA (scoring.smaSlope): its change over the lookback hours, in daily ATRs.
export const smaSlopeAtrAtHour = (facts: IWatchFacts, hour: string, close: number): number | null => {
    const pct = smaChangePct([...closesBefore(facts, hour), close], globalConfig.PremarketRace.smaPeriod, RaceRulesConfig.scoring.smaSlope.lookbackHours);
    return pct === null || facts.atrPct <= 0 ? null : pct / facts.atrPct;
};

// The same angle at yesterday's last hourly candle, before today's candles.
export const priorSmaSlopeAtr = (facts: IWatchFacts): number | null => {
    const pct = smaChangePct(facts.priorHourlyCloses, globalConfig.PremarketRace.smaPeriod, RaceRulesConfig.scoring.smaSlope.lookbackHours);
    return pct === null || facts.atrPct <= 0 ? null : pct / facts.atrPct;
};

// The SMA at a 5-minute candle, with `price` as the current hour's close.
export const smaAtBar = (facts: IWatchFacts, period: number, bar: IWatchBar, price: number) => smaAtHour(facts, period, bar.time.substring(0, 2), price);

// Healthy before the bell, the race's rule: none of the last hourlyCloseLookbackHours pre-market hourly candles with
// trades closed through the hourly 20 SMA.
export const healthyPremarket = (facts: IWatchFacts): boolean | null => {
    const period = globalConfig.PremarketRace.smaPeriod;
    const firstJudged = 9 - RaceRulesConfig.hourlyCloseLookbackHours;
    const premarket = facts.hours.filter((hour) => hour.hour < '09' && Number(hour.hour) >= firstJudged && hour.complete);
    if (facts.priorHourlyCloses.length < period || premarket.length === 0) {
        return null;
    }
    return premarket.filter((hour) => hour.traded).every((hour) => {
        const sma = smaAtHour(facts, period, hour.hour, hour.close) as number;
        return ((hour.close - sma) / sma) * 100 >= -RaceRulesConfig.smaTolerancePct;
    });
};

// The board's "Uptrend": the open above the fast and the slow daily SMA.
export const inUptrend = (facts: IWatchFacts): boolean => !!dailyTrend(facts.dailySmas, facts.openingPrice)?.isUptrend;
