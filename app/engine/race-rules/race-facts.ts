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
    reclaimSmaPeriod: number;
    reclaimedYesterday: IYesterdayReclaim | null;
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
    const closesSoFar = [...input.priorHourlyCloses, ...completedCloses(hourlyCandles.slice(0, -1)), currentCandle.close];
    const sma = _.mean(_.takeRight(closesSoFar, input.smaPeriod));
    const reclaimSma = closesSoFar.length >= input.reclaimSmaPeriod ? _.mean(_.takeRight(closesSoFar, input.reclaimSmaPeriod)) : null;
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

        reclaimSma,
        reclaimSmaCushionPct: reclaimSma ? toDirectional(pctFrom(openingBar ? openingBar.open : price, reclaimSma)) : null,
        reclaimedYesterday: input.reclaimedYesterday,

        openingPrice: openingBar ? openingBar.open : null,
        openingGapPct: openingBar ? toDirectional(pctFrom(openingBar.open, previousClose)) : null,
        openingVsPreviousExtremePct: openingBar && previousExtreme ? toDirectional(pctFrom(openingBar.open, previousExtreme)) : null,
    };
};

// Today's pre-market 5-minute bars grouped into hourly candles, each with the 20 SMA as it stood at that candle.
// Hours without trades carry the previous close, like the broker chart (see fillEmptyHours in alpaca-api).
// After the bell the last pre-market hour counts as closed, even though its hourly candle runs past 09:30.
const buildHourlyCandles = (input: IRaceFactsInput, toDirectional: (value: number) => number): IHourlyCandleFacts[] => {
    const { intervals, premarketKeys, raceEnd, isAfterBell, smaPeriod, direction } = input;
    const keysByHour = _.groupBy(premarketKeys, (key) => key.substring(11, 13));
    const closes = [...input.priorHourlyCloses];
    const date = premarketKeys[0].substring(0, 10);
    const firstHour = Math.min(Number(premarketKeys[0].substring(11, 13)), 4);
    const lastHour = Math.min(Number(input.bellKey.substring(11, 13)), raceEnd.clone().subtract(1, 'minute').tz(NEW_YORK).hour());
    const hours = _.range(firstHour, lastHour + 1).map((hour) => String(hour).padStart(2, '0'));
    let previousClose = _.last(closes) ?? intervals[premarketKeys[0]].open;

    return hours
        .filter((hour) => keysByHour[hour] || closes.length > 0)
        .map((hour) => {
            const keys = keysByHour[hour] || [];
            const close = keys.length > 0 ? intervals[_.last(keys) as string].close : previousClose;
            const wick =
                keys.length === 0
                    ? close
                    : direction === 'long'
                    ? Math.min(...keys.map((key) => intervals[key].low))
                    : Math.max(...keys.map((key) => intervals[key].high));
            previousClose = close;
            const hourEnd = moment.tz(`${date} ${hour}:00:00`, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).add(1, 'hour');
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

export interface IPriorHourlyCandle {
    key: string; // New York 'YYYY-MM-DD HH:mm:ss', candle start
    high: number;
    low: number;
    close: number;
}

export interface IYesterdayReclaim {
    openedAt: number; // yesterday's regular-session open
    smaAtOpen: number;
    reachedAtHour: string; // "13" for the 13:00 candle that touched the SMA
}

// Yesterday opened on the wrong side of the hourly SMA and climbed (long) / fell (short) back to it during the
// regular session. The SMA at the open is the line entering the 09:00 candle; a candle "reaches" it when its
// high (long) / low (short) touches the SMA including that candle.
export const yesterdayReclaim = (
    candles: IPriorHourlyCandle[],
    yesterday: string,
    yesterdayOpen: number | null,
    period: number,
    direction: RaceDirection
): IYesterdayReclaim | null => {
    const openIndex = candles.findIndex((candle) => candle.key >= `${yesterday} 09:00:00`);
    if (!yesterdayOpen || openIndex < period || !candles[openIndex].key.startsWith(yesterday)) {
        return null;
    }
    const smaAt = (endIndex: number) => _.meanBy(candles.slice(endIndex - period + 1, endIndex + 1), 'close');
    const isLong = direction === 'long';

    const smaAtOpen = smaAt(openIndex - 1);
    if (isLong ? yesterdayOpen >= smaAtOpen : yesterdayOpen <= smaAtOpen) {
        return null;
    }

    for (let index = openIndex; index < candles.length && candles[index].key < `${yesterday} 16:00:00`; index++) {
        const candle = candles[index];
        const sma = smaAt(index);
        if (isLong ? candle.high >= sma : candle.low <= sma) {
            return { openedAt: yesterdayOpen, smaAtOpen, reachedAtHour: candle.key.substring(11, 13) };
        }
    }
    return null;
};

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
