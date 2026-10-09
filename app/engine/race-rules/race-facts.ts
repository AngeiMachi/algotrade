import * as _ from 'lodash';
import moment from 'moment-timezone';

import { RaceRulesConfig } from '../../config/race-rules.config';
import { IQuoteIntervals } from '../../models/quote-data.model';
import { IHourlyCandleFacts, IPremarketVolumeDay, IRaceFacts, RaceDirection } from './race-rule.types';

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
    priorTradedHourlyCloses: number[]; // the same, skipping hours without trades
    reclaimSmaPeriod: number;
    yesterdayBelowReclaimSma: IYesterdayBelowSma | null;
    premarketVolumeHistory: IPremarketVolumeDay[]; // recent sessions' pre-market 5-minute volume
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
    const tradedClosesSoFar = [
        ...input.priorTradedHourlyCloses,
        ...completedCloses(hourlyCandles.slice(0, -1).filter((candle) => candle.traded)),
        currentCandle.close,
    ];
    const reclaimSmaOf = (list: number[]) => (list.length >= input.reclaimSmaPeriod ? _.mean(_.takeRight(list, input.reclaimSmaPeriod)) : null);
    const reclaimReadings = [reclaimSmaOf(closesSoFar), reclaimSmaOf(tradedClosesSoFar)];
    const reclaimSma = reclaimReadings.every((reading) => reading !== null) ? stricterSma(reclaimReadings as number[], direction) : null;
    const smaCushionPct = toDirectional(pctFrom(price, sma));
    const atrPct = input.atrPct > 0 ? input.atrPct : RaceRulesConfig.fallbackAtrPct;

    const openingBar = input.isAfterBell ? intervals[input.bellKey] : undefined;
    const previousExtreme = direction === 'long' ? input.previousHigh : input.previousLow;

    const reclaimSmaCushionPct = reclaimSma ? toDirectional(pctFrom(openingBar ? openingBar.open : price, reclaimSma)) : null;

    const premarketVolume = _.sumBy(bars, 'volume');
    const lastCandle = (_.last(premarketKeys) as string).substring(11, 16);
    const averagePremarketVolume = averageVolumeUntil(input.premarketVolumeHistory, lastCandle);

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
        premarketVolume,
        premarketDollarVolume: _.sumBy(bars, (bar) => bar.volume * bar.close),
        averagePremarketVolume,
        relativeVolume: averagePremarketVolume ? premarketVolume / averagePremarketVolume : null,
        lastCandle,

        sma,
        smaCushionPct,
        smaStretchAtr: smaCushionPct / atrPct,
        hourlyCandles,
        smaTouches: hourlyCandles.filter((candle) => candle.wickVsSmaPct < 0).length,

        reclaimSma,
        reclaimSmaCushionPct,
        yesterdayBelowReclaimSma: input.yesterdayBelowReclaimSma,
        reclaimedSma: !!input.yesterdayBelowReclaimSma && reclaimSmaCushionPct !== null && reclaimSmaCushionPct > 0,

        openingPrice: openingBar ? openingBar.open : null,
        openingGapPct: openingBar ? toDirectional(pctFrom(openingBar.open, previousClose)) : null,
        openingVsPreviousExtremePct: openingBar && previousExtreme ? toDirectional(pctFrom(openingBar.open, previousExtreme)) : null,
    };
};

// Average pre-market volume of past sessions from 04:00 up to and including the `lastCandle` 5-minute bar, so an
// 08:40 reading is compared with past 08:40 readings (pre-market volume piles up toward the bell).
const averageVolumeUntil = (history: IPremarketVolumeDay[], lastCandle: string): number | null => {
    if (history.length === 0) {
        return null;
    }
    return _.meanBy(history, (day) => _.sumBy(day.bars.filter((bar) => bar.time <= lastCandle), 'volume')) || null;
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
                traded: keys.length > 0,
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
    traded: boolean; // false for hours filled with the previous close
}

export interface IYesterdayBelowSma {
    openedAt: number; // yesterday's regular-session open
    smaAtOpen: number;
}

// The broker chart's hourly 200 SMA sits between two readings of our data: with empty hours filled, and with
// traded hours only (the broker skips empty hours but has overnight trades Alpaca lacks). Neither matches every
// chart, so "MA reclaimed" only counts a side of the SMA when both readings agree. `stricterSma` picks the reading
// that is harder to be on the good side of.
export const stricterSma = (readings: number[], direction: RaceDirection) => (direction === 'long' ? Math.max(...readings) : Math.min(...readings));
const looserSma = (readings: number[], direction: RaceDirection) => (direction === 'long' ? Math.min(...readings) : Math.max(...readings));

// Yesterday opened on the bad side of the hourly SMA (below for long, above for short) in both readings.
// The SMA at the open is the line entering the 09:00 candle.
export const yesterdayOpenedBelowSma = (
    candles: IPriorHourlyCandle[],
    yesterday: string,
    yesterdayOpen: number | null,
    period: number,
    direction: RaceDirection
): IYesterdayBelowSma | null => {
    if (!yesterdayOpen) {
        return null;
    }
    const smaBeforeOpen = (list: IPriorHourlyCandle[]) => {
        const end = _.findLastIndex(list, (candle) => candle.key < `${yesterday} 09:00:00`);
        return end + 1 >= period ? _.meanBy(list.slice(end - period + 1, end + 1), 'close') : null;
    };
    const readings = [smaBeforeOpen(candles), smaBeforeOpen(candles.filter((candle) => candle.traded))];
    if (readings.some((reading) => reading === null)) {
        return null;
    }
    const smaAtOpen = looserSma(readings as number[], direction);
    const openedBelow = direction === 'long' ? yesterdayOpen < smaAtOpen : yesterdayOpen > smaAtOpen;
    return openedBelow ? { openedAt: yesterdayOpen, smaAtOpen } : null;
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
