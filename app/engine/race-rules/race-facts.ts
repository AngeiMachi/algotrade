import * as _ from 'lodash';
import moment from 'moment-timezone';

import { RaceRulesConfig } from '../../config/race-rules.config';
import { IQuoteIntervals } from '../../models/quote-data.model';
import { IHourlyCandleFacts, IRaceFacts, RaceDirection } from './race-rule.types';

const NEW_YORK = 'America/New_York';

export interface IRaceFactsInput {
    quote: string;
    direction: RaceDirection;
    smaPeriod: number;
    previousClose: number;
    previousHigh: number | null;
    previousLow: number | null;
    atrPct: number;
    priorHourlyCloses: number[]; // 24-hour hourly closes before today's pre-market
    intervals: IQuoteIntervals; // 5-minute bars keyed by New York time
    premarketKeys: string[]; // today's pre-market bar keys, sorted
    bellKey: string;
    raceEnd: moment.Moment; // end of the latest candle in the race
    isAfterBell: boolean;
}

// Turns raw bars into the plain numbers every rule reads. No judgement happens here.
export const buildRaceFacts = (input: IRaceFactsInput): IRaceFacts => {
    const { direction, previousClose, intervals, premarketKeys } = input;
    const toDirectional = (value: number) => (direction === 'long' ? value : -value);
    const pctFrom = (value: number, base: number) => ((value - base) / base) * 100;

    const bars = premarketKeys.map((key) => intervals[key]);
    const price = (_.last(bars) as { close: number }).close;
    const gapPct = toDirectional(pctFrom(price, previousClose));

    const hourlyCandles = buildHourlyCandles(input, toDirectional);
    const currentCandle = _.last(hourlyCandles) as IHourlyCandleFacts;
    const smaWindow = _.takeRight([...input.priorHourlyCloses, ...completedCloses(hourlyCandles.slice(0, -1)), currentCandle.close], input.smaPeriod);
    const sma = _.mean(smaWindow);
    const smaCushionPct = toDirectional(pctFrom(price, sma));
    const atrPct = input.atrPct > 0 ? input.atrPct : RaceRulesConfig.fallbackAtrPct;

    const openingBar = input.isAfterBell ? intervals[input.bellKey] : undefined;
    const previousExtreme = direction === 'long' ? input.previousHigh : input.previousLow;

    return {
        quote: input.quote,
        direction,
        isAfterBell: input.isAfterBell,
        bellTime: input.bellKey.substring(11, 16),

        previousClose,
        previousExtreme,
        previousExtremeCushionPct: previousExtreme ? toDirectional(pctFrom(price, previousExtreme)) : null,
        price,
        gapPct,
        gapInAtr: input.atrPct > 0 ? gapPct / input.atrPct : 0,
        atrPct: input.atrPct,
        premarketVolume: _.sumBy(bars, 'volume'),
        premarketDollarVolume: _.sumBy(bars, (bar) => bar.volume * bar.close),
        lastCandle: (_.last(premarketKeys) as string).substring(11, 16),

        sma,
        smaCushionPct,
        smaStretchAtr: smaCushionPct / atrPct,
        hourlyCandles,
        smaTouches: hourlyCandles.filter((candle) => candle.wickVsSmaPct < 0).length,

        openingPrice: openingBar ? openingBar.open : null,
        openingGapPct: openingBar ? toDirectional(pctFrom(openingBar.open, previousClose)) : null,
        openingVsPreviousExtremePct: openingBar && previousExtreme ? toDirectional(pctFrom(openingBar.open, previousExtreme)) : null,
    };
};

// Today's pre-market 5-minute bars grouped into hourly candles, each with the 20 SMA as it stood at that candle.
// After the bell the last pre-market hour counts as closed, even though its hourly candle runs past 09:30.
const buildHourlyCandles = (input: IRaceFactsInput, toDirectional: (value: number) => number): IHourlyCandleFacts[] => {
    const { intervals, premarketKeys, raceEnd, isAfterBell, smaPeriod, direction } = input;
    const keysByHour = _.groupBy(premarketKeys, (key) => key.substring(11, 13));
    const closes = [...input.priorHourlyCloses];

    return Object.keys(keysByHour)
        .sort()
        .map((hour) => {
            const keys = keysByHour[hour];
            const close = intervals[_.last(keys) as string].close;
            const wick = direction === 'long' ? Math.min(...keys.map((key) => intervals[key].low)) : Math.max(...keys.map((key) => intervals[key].high));
            const hourEnd = moment.tz(`${keys[0].substring(0, 10)} ${hour}:00:00`, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).add(1, 'hour');
            const complete = isAfterBell || !hourEnd.isAfter(raceEnd);

            const sma = _.mean(_.takeRight([...closes, close], smaPeriod));
            if (complete) {
                closes.push(close);
            }

            return {
                hour,
                close,
                sma,
                complete,
                closeVsSmaPct: toDirectional(((close - sma) / sma) * 100),
                wickVsSmaPct: toDirectional(((wick - sma) / sma) * 100),
            };
        });
};

const completedCloses = (candles: IHourlyCandleFacts[]) => candles.filter((candle) => candle.complete).map((candle) => candle.close);

export interface IDailySmas {
    fastSma: number;
    slowSma: number;
}

export interface IDailyTrend extends IDailySmas {
    fastAboveSlow: boolean;
    priceAboveSlow: boolean;
    isUptrend: boolean;
}

// Daily fast and slow SMA of closes before today. Null when there is not enough history for the slow one.
export const dailySmas = (dailyCandles: { close: number }[], fastDays: number, slowDays: number): IDailySmas | null => {
    if (dailyCandles.length < slowDays) {
        return null;
    }
    return {
        fastSma: _.meanBy(_.takeRight(dailyCandles, fastDays), 'close'),
        slowSma: _.meanBy(_.takeRight(dailyCandles, slowDays), 'close'),
    };
};

// Uptrend when the fast daily SMA is above the slow one, or today's price (the open, once the bell rings) is above the slow one.
export const dailyTrend = (smas: IDailySmas | null, price: number | null): IDailyTrend | null => {
    if (!smas) {
        return null;
    }
    const fastAboveSlow = smas.fastSma > smas.slowSma;
    const priceAboveSlow = price !== null && price > smas.slowSma;
    return { ...smas, fastAboveSlow, priceAboveSlow, isUptrend: fastAboveSlow || priceAboveSlow };
};

// Average True Range over the last `period` daily candles, as a percent of the latest close.
export const averageTrueRangePct = (dailyCandles: { high: number; low: number; close: number }[], period: number): number => {
    const recent = _.takeRight(dailyCandles, period + 1);
    if (recent.length < 2) {
        return 0;
    }
    const trueRanges = recent
        .slice(1)
        .map((candle, index) => Math.max(candle.high - candle.low, Math.abs(candle.high - recent[index].close), Math.abs(candle.low - recent[index].close)));
    return (_.mean(trueRanges) / (_.last(recent) as { close: number }).close) * 100;
};
