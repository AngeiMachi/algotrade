import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';

import * as convertUtils from './convert-utils';
import { convertDateToTDMillisecondInterval } from './convert-utils';

import {
    ITDAmeritradeIntervalData,
    IQuotesHistoricalData,
    IQuoteMetadata,
    IQuoteIntervals,
    IQuoteFullIntervalData,
    IMarketHours,
    SessionHoursDefault,
    ITDAmeritradePriceHistory,
} from '../models/quote-data.model';
import { TimeFrame } from '../models/enums';

export function getCurrentTradingDate() {
    let mockDataDate: string;
    if (globalConfig.Mock.IsMock && globalConfig.Mock.MockDataDate) {
        mockDataDate = globalConfig.Mock.MockDataDate;
    } else {
        mockDataDate = moment(new Date()).format('YYYY-MM-DD');
    }

    return mockDataDate;
}

export function getPreviousTradingDate(tradingDate: string | number) {
    let substractDays: number = 1;
    if (moment(tradingDate).day() == 1) {
        substractDays = 3;
    } else if (moment(tradingDate).day() == 0) {
        substractDays = 2;
    }
    if (typeof tradingDate === 'string') {
        return moment(tradingDate).subtract(substractDays, 'days').format('YYYY-MM-DD');
    }
    return substractDays - 86400000 * substractDays; // 86400000 = 24 hours in milliseconds
}

export function calculateAverage(intervals: ITDAmeritradeIntervalData[], tradingDate: string, intervalsToAverageBack: number): number {
    const dayBefore = getPreviousTradingDate(tradingDate) as string;
    const index = getLastTradingDateIndex(intervals, dayBefore);
    if (index > -1) {
        const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, 'volume');
        return average;
    }
    return -1;
}

export function calculateMovingAverage(
    intervals: ITDAmeritradeIntervalData[],
    tradingDate: string,
    intervalsToAverageBack: number,
    firstIntradayInterval?: IQuoteFullIntervalData,
    type: 'open' | 'close' = 'close'
): number {
    const firstIntradayIntervalCopy = { ...firstIntradayInterval } as IQuoteFullIntervalData;
    if (firstIntradayInterval) {
        const index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate) as string);
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack + 1, index + 1);
            const average = _.meanBy([...intervalsForAverage, firstIntradayIntervalCopy], type);
            return average;
        }
    } else {
        const index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate) as string);
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack + 1, index + 1);
            const average = _.meanBy(intervalsForAverage, type);
            return average;
        }
    }
    return -1;
}

export function getPreviousCandle(intervals: ITDAmeritradeIntervalData[], tradingDate: string, timeFrame: TimeFrame = TimeFrame.Daily): ITDAmeritradeIntervalData | null {
    let previousDay: string;
    let index: number = -1;

    if (timeFrame == TimeFrame.Daily) {
        previousDay = getPreviousTradingDate(tradingDate) as string;
        index = getLastTradingDateIndex(intervals, previousDay);
    } else if (timeFrame == TimeFrame.Weekly) {
        index = getLastTradingWeekIndex(intervals, tradingDate);
    }

    if (index > -1) {
        return intervals[index];
    }
    return null;
}

export function getPartialHistory(intervals: ITDAmeritradeIntervalData[], tradingDate: string | number, intervalsToHistoryBack: number): ITDAmeritradeIntervalData[] {
    let index;

    if (typeof tradingDate === 'string') {
        const dayBefore = getPreviousTradingDate(tradingDate) as string;
        index = getIntervalIndex(intervals, dayBefore);
    } else {
        const dayBefore = getPreviousTradingDate(tradingDate);
        index = _.findIndex(intervals, ['datetime', dayBefore]);
    }
    if (index > -1) {
        const intervalsBack = _.slice(intervals, index - intervalsToHistoryBack, index);
        return intervalsBack;
    }
    return [];
}

function getIntervalIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string) {
    try {
        // date is 00:00 . TDAmeritrade daily interval is at 08:00 = 28800000 or 07:00 = 25200000
        const currentTimeInMilliseconds = convertDateToTDMillisecondInterval(tradingDate);

        if (currentTimeInMilliseconds < intervals[0].datetime || currentTimeInMilliseconds > intervals[intervals.length - 1].datetime) {
            logger.error('Quote-Utils.getIntervalIndex interval out of bounds');
            throw 'interval out of bounds';
        }

        let index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds + 28800000]);
        if (index > -1) {
            return index;
        }
        index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds + 25200000]);

        return index;
    } catch (error) {
        return -1;
    }
}

function getLastTradingDateIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string) {
    let lastTradingDateIndex = -1;
    let lastTradingDate = tradingDate;
    while (lastTradingDateIndex === -1) {
        lastTradingDateIndex = getIntervalIndex(intervals, lastTradingDate);
        lastTradingDate = moment(lastTradingDate).subtract(1, 'days').format('YYYY-MM-DD');
    }

    return lastTradingDateIndex;
}
function getLastTradingWeekIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string) {
    let lastTradingDateIndex = -1;
    let lastTradingDate = moment(tradingDate).subtract(6, 'days').format('YYYY-MM-DD');
    while (lastTradingDateIndex === -1) {
        lastTradingDateIndex = getIntervalIndex(intervals, lastTradingDate);
        lastTradingDate = moment(lastTradingDate).subtract(1, 'days').format('YYYY-MM-DD');
    }

    return lastTradingDateIndex;
}
export function composeMetadata(
    this: any,
    tradingDate: string,
    historicalData: IQuotesHistoricalData,
    quoteIntervals: IQuoteIntervals,
    markethours: IMarketHours
): IQuoteMetadata {
    const firstInterval: IQuoteFullIntervalData = getRecentFirstIntervalData(quoteIntervals, markethours);

    const dailyIntervals = historicalData?.quoteFullYearDailyHistory.candles;
    const weeklyIntervals = historicalData?.quoteFullYearWeeklyHistory.candles;

    const { week52high, week52low } = get52WeekHighAndLow(historicalData.quoteFullYearWeeklyHistory);

    const quoteMetadata: IQuoteMetadata = {
        preMarketMetadata: getPreMarketIntervalData(quoteIntervals, markethours),
        averageDailyVolume10Day: calculateAverage(dailyIntervals, tradingDate, 10),
        averageDailyVolume3Month: calculateAverage(dailyIntervals, tradingDate, 90),
        get average5Minute3Month() {
            return (this.averageDailyVolume3Month as number) / 78;
        },
        previousDay: convertUtils.convertTDAmeritradeDailyIntervals([getPreviousCandle(dailyIntervals, tradingDate) as ITDAmeritradeIntervalData])[0],
        previousWeek: convertUtils.convertTDAmeritradeDailyIntervals([getPreviousCandle(weeklyIntervals, tradingDate, TimeFrame.Weekly) as ITDAmeritradeIntervalData])[0],
        SMA5: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 5, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 5),
        },
        SMA10: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 10, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 10),
        },
        SMA20: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 20, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 20),
        },
        SMA50: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 50, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 50),
        },
        SMA100: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 100, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 100),
        },
        SMA200: {
            today: calculateMovingAverage(dailyIntervals, tradingDate, 200, firstInterval),
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 200),
        },

        // TODO :  put true values
        fiftyTwoWeekLow: week52low,
        fiftyTwoWeekHigh: week52high,

        fullYearDailyHistory: historicalData.quoteFullYearDailyHistory.candles,
        fullYearWeeklyHistory: historicalData.quoteFullYearWeeklyHistory.candles,
        dailyHistoricalData: convertUtils.convertTDAmeritradeDailyIntervals(getPartialHistory(dailyIntervals, tradingDate, 10)),
    };
    quoteMetadata.SMA5.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA5.today);
    quoteMetadata.SMA10.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA10.today);
    quoteMetadata.SMA20.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA20.today);
    quoteMetadata.SMA50.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA50.today);
    quoteMetadata.SMA100.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA100.today);
    quoteMetadata.SMA200.didOpenOboveSMA = isAboveMovingAverage(firstInterval, quoteMetadata.SMA200.today);

    return quoteMetadata;
}

export function removoLastIntervalData(intervals: IQuoteIntervals): IQuoteIntervals {
    delete intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]];
    return intervals;
}

export function getRecentIntervalData(intervals: IQuoteIntervals) {
    return intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]];
}

export function getRecentFirstIntervalData(intervals: IQuoteIntervals, markethours: IMarketHours, preMarket: boolean = false) {
    if (preMarket) {
        return intervals[Object.keys(intervals)[0]];
    } else {
        let i = 0;
        for (let key of Object.keys(intervals)) {
            if (key == markethours.sessionHours.regularMarket.start) {
                break;
            }
            i++;
        }

        return intervals[Object.keys(intervals)[i]];
    }
}

export function getPreMarketIntervalData(intervals: IQuoteIntervals, markethours: IMarketHours) {
    const preMarketIntervals: IQuoteIntervals = {};
    let maxInterval: IQuoteFullIntervalData = getRecentFirstIntervalData(intervals, markethours, true);
    let maxHigh = 0;

    for (let key of Object.keys(intervals)) {
        if (key === markethours.sessionHours.preMarket.end) {
            break;
        }
        preMarketIntervals[key] = { ...intervals[key] };
        if (intervals[key].high > maxHigh) {
            maxInterval = intervals[key];
            maxHigh = intervals[key].high;
        }
    }

    return {
        preMarketIntervals: preMarketIntervals,
        preMarketHOD: maxInterval,
    };
}

export function cleanPreMarketIntervals(intervals: IQuoteIntervals, markethours: IMarketHours): IQuoteIntervals {
    for (let key of Object.keys(intervals)) {
        if (key === markethours.sessionHours.preMarket.end) {
            break;
        }
        delete intervals[key];
    }

    return intervals;
}

export function generateDefaultMarketHours() {
    const date = getCurrentTradingDate();
    const marketHours = {} as IMarketHours;

    marketHours.date = date;
    marketHours.isApiMarketHours = false;
    marketHours.sessionHours = { ...SessionHoursDefault };

    marketHours.sessionHours.preMarket.start = date + ' 07:00:00';
    marketHours.sessionHours.preMarket.end = date + ' 09:30:00';
    marketHours.sessionHours.regularMarket.start = date + ' 09:30:00';
    marketHours.sessionHours.regularMarket.end = date + ' 16:00:00';
    marketHours.sessionHours.postMarket.start = date + ' 16:00:00';
    marketHours.sessionHours.postMarket.end = date + ' 20:00:00';

    return marketHours;
}

export function isAboveMovingAverage(interval: IQuoteFullIntervalData, movingAverage: number): boolean {
    return interval.open > movingAverage ? true : false;
}

export function isCandleBullish(interval: IQuoteFullIntervalData): boolean {
    if (interval.close < interval.open) {
        return false;
    }

    return interval.close - interval.open > interval.high - interval.close ? true : false;
}

function get52WeekHighAndLow(quoteFullYearWeeklyHistory: ITDAmeritradePriceHistory) {
    let week52low: number = 10000,
        week52high: number = 0;

    quoteFullYearWeeklyHistory.candles.forEach((candle) => {
        if (candle.high > week52high) {
            week52high = candle.high;
        }
        if (candle.low < week52low) {
            week52low = candle.low;
        }
    });
    return { week52high, week52low };
}
