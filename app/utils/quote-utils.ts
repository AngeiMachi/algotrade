import * as _ from 'lodash';
import moment from 'moment-timezone';
import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';
import * as convertUtils from './convert-utils';
import * as generalUtils from './general';
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

let  _marketHours = {} as IMarketHours;

export const getMarketHours=() => {
        return _marketHours;
}
export const setMarketHours=(marketHours:IMarketHours) => {
    _marketHours=marketHours;
}

export const isPremarketTimeByInterval= (quoteInterval: IQuoteFullIntervalData)=>{
 return new Date(getMarketHours().sessionHours.regularMarket.start) > new Date(quoteInterval.timeNewYork);
}

export const isIntervalOfCurrentTradingDate = (quoteInterval: IQuoteFullIntervalData | string) => {
    if (typeof quoteInterval==="string") {
        return quoteInterval.includes(getCurrentTradingDate());
    } else {
        const propertyName =moment(quoteInterval.timeNewYork).format('YYYY-MM-DD HH:mm:ss').toString();
        return propertyName.includes(getCurrentTradingDate())
    }
   
}
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

export function calculateAverageVolume(intervals: ITDAmeritradeIntervalData[], tradingDate: string, intervalsToAverageBack: number): number {
    const dayBefore = getPreviousTradingDate(tradingDate) as string;
    const index = getLastTradingDateIndex(intervals, dayBefore);
    if (index > -1) {
        const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, 'volume');
        return average;
    }
    return -1;
}

export function calculateAverageVolatility(intervals: ITDAmeritradeIntervalData[], tradingDate: string, intervalsToAverageBack: number): number {
    const dayBefore = getPreviousTradingDate(tradingDate) as string;
    const index = getLastTradingDateIndex(intervals, dayBefore);
    if (index > -1) {
        const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack, index);
        let sum=0;
        for (let i=1;i<intervalsForAverage.length;i++) {
            sum+= generalUtils.getPercentageDifference(intervalsForAverage[i-1].close,intervalsForAverage[i].close);
        }
        return sum/intervalsToAverageBack;
        //const average = _.meanBy(intervalsForAverage, item=>generalUtils.getPercentageDifference(item.open,item.close));
        //return average;
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
        let index = 0
        if (globalConfig.Mock.IsMock) {
            index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate) as string);
        } else {
            index = intervals.length-1;
        }
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack + 1, index + 1);
            const average = _.meanBy([...intervalsForAverage, firstIntradayIntervalCopy], type);
            return average;
        }
    } else {
        let index = 0
        if (globalConfig.Mock.IsMock) {
            index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate) as string);
        } else {
            index = intervals.length-1;
        }
        
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack + 1, index + 1);
            const average = _.meanBy(intervalsForAverage, type);
            return average;
        }
    }
    return -1;
}

export function getPreviousCandle(intervals: ITDAmeritradeIntervalData[], tradingDate: string, timeFrame: TimeFrame = TimeFrame.Daily): ITDAmeritradeIntervalData | null {
    let previousDay: string=tradingDate;
    let index: number = -1;
    let retryCount = 10;

    if (timeFrame == TimeFrame.Daily) {
        while (index===-1 || intervals.length===0 || retryCount<=0){

            previousDay = getPreviousTradingDate(previousDay) as string;
            index = getLastTradingDateIndex(intervals, previousDay);
            retryCount--;
        }
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
        // Professional approach: Support both TD Ameritrade and Yahoo Finance data formats
        
        // Handle Yahoo Finance format (real timestamps)
        if (intervals.length > 0 && intervals[0].datetime && intervals[0].datetime > 1000000000000) {
            // Yahoo Finance timestamps are in milliseconds, find the closest trading day
            const targetDate = moment.tz(tradingDate, 'America/New_York').startOf('day');
            const targetDateEnd = moment.tz(tradingDate, 'America/New_York').endOf('day');
            
            // Find intervals for the target trading date
            const dayIntervals = intervals.filter(interval => {
                const intervalDate = moment(interval.datetime).tz('America/New_York');
                return intervalDate.isSameOrAfter(targetDate) && intervalDate.isSameOrBefore(targetDateEnd);
            });
            
            if (dayIntervals.length > 0) {
                // Return the index of the last interval for the target date
                const lastInterval = dayIntervals[dayIntervals.length - 1];
                return _.findIndex(intervals, ['datetime', lastInterval.datetime]);
            }
            
            logger.warn(`Quote-Utils.getIntervalIndex: No intervals found for date ${tradingDate}`);
            return -1;
        }
        
        // Legacy TD Ameritrade format support
        const currentTimeInMilliseconds = convertDateToTDMillisecondInterval(tradingDate);

        if (currentTimeInMilliseconds < intervals[0].datetime ) {
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
        logger.error('Quote-Utils.getIntervalIndex error:', error);
        return -1;
    }
}

function getLastTradingDateIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string) {
    let lastTradingDateIndex = -1;
    let lastTradingDate = tradingDate;
    let countIterations=0;
    while (lastTradingDateIndex === -1) {
        countIterations++;
        lastTradingDateIndex = getIntervalIndex(intervals, lastTradingDate);
        if (countIterations === 7) {
            break;
        }
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
    tradingDate: string,
    historicalData: IQuotesHistoricalData,
): IQuoteMetadata {
    
    const dailyIntervals = historicalData?.quoteFullYearDailyHistory.candles;
    const weeklyIntervals = historicalData?.quoteFullYearWeeklyHistory.candles;
    const hourlyIntervals = historicalData?.quoteHourlyHistory.candles;

    const { week52high, week52low } = get52WeekHighAndLow(historicalData.quoteFullYearWeeklyHistory);

    const quoteMetadata: IQuoteMetadata = {
        //getPreMarketIntervalData(quoteIntervals, markethours),
        preMarketMetadata: {
            preMarketIntervals:{},
            preMarketHOD: {} as IQuoteFullIntervalData,
            preMarketLOD: {} as IQuoteFullIntervalData,
            premarketCloseIntervals:[]
        },
        averageDailyVolume10Day: calculateAverageVolume(dailyIntervals, tradingDate, 10),
        averageDailyVolume3Month: calculateAverageVolume(dailyIntervals, tradingDate, 90),
        averageVolatility30Day: calculateAverageVolatility(dailyIntervals, tradingDate, 30),
        get average5Minute3Month() {
            return (this.averageDailyVolume3Month as number) / 78;
        },

        previousDay: convertUtils.convertTDAmeritradeDailyIntervals([getPreviousCandle(dailyIntervals, tradingDate) as ITDAmeritradeIntervalData])[0],
        previousWeek: convertUtils.convertTDAmeritradeDailyIntervals([getPreviousCandle(weeklyIntervals, tradingDate, TimeFrame.Weekly) as ITDAmeritradeIntervalData])[0],
        SMA5: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 5),
        },
        SMA10: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 10),
        },
        SMA20: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 20),
        },
        SMA50: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 50),
        },
        SMA100: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 100),
        },
        SMA200: {
            previousDay: calculateMovingAverage(dailyIntervals, tradingDate, 200),
        },

        fiftyTwoWeekLow: week52low,
        fiftyTwoWeekHigh: week52high,

        fullYearDailyHistory: historicalData.quoteFullYearDailyHistory.candles,
        fullYearWeeklyHistory: historicalData.quoteFullYearWeeklyHistory.candles,
        hourlyHistory:convertUtils.convertTDAmeritradeDailyIntervals(hourlyIntervals),
        dailyHistoricalData: convertUtils.convertTDAmeritradeDailyIntervals(getPartialHistory(dailyIntervals, tradingDate, 10)),
    };

    return quoteMetadata;
}

export function removoLastIntervalData(intervals: IQuoteIntervals): IQuoteIntervals {
    const ObjectKeys= Object.keys(intervals);
    if (ObjectKeys.length>0) {
        //@ts-ignore
        const lastInterval =intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]].timeIsrael;
        const intervalTime = moment(new Date(lastInterval)).add(5,'m').toDate(); 
        if (intervalTime>new Date()) {
            //logger.info(new Date()+': removing Interval:'+JSON.stringify(intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]]))
             delete intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]];
        }
    }
    return intervals;
}

export function getRecentIntervalData(intervals: IQuoteIntervals) {
    return intervals[Object.keys(intervals)[Object.keys(intervals).length - 1]];
}

export function getRecentFirstIntervalData(intervals: IQuoteIntervals, markethours: IMarketHours, IncludingpreMarket: boolean = false) {
    if (IncludingpreMarket) {
        return intervals[Object.keys(intervals)[Object.keys(intervals).length-1]];
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
    const premarketCloseIntervals: IQuoteFullIntervalData[] = [];
    let maxInterval= {} as IQuoteFullIntervalData;
    let maxHigh = 0;

    for (let key of Object.keys(intervals)) {
        if (!key.includes(markethours.date)) {
            continue;
        }
        if (key === markethours.sessionHours.preMarket.end) {
            break;
        }
        preMarketIntervals[key] = { ...intervals[key] };
        if (intervals[key].high > maxHigh) {
            maxInterval = intervals[key];
            maxHigh = intervals[key].high;
        }

        if (key.includes(':55:00')) {
            premarketCloseIntervals.push(intervals[key]);
        }
    }

    return {
        preMarketIntervals: preMarketIntervals,
        preMarketHOD: maxInterval,
        premarketCloseIntervals
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
    if (!interval) {
        logger.info("isAboveMovingAverage- interval is empty");
        true;
    }
    return interval?.open > movingAverage ? true : false;
}

export function isCandleBullish(interval: IQuoteFullIntervalData): boolean {
    if (interval.close < interval.open) {
        return false;
    }

    return interval.close - interval.open > interval.high - interval.close ? true : false;
}

export function getPercentageChange(interval: IQuoteFullIntervalData, basePrice: number, isFromOpen: boolean = true) {
    if (isFromOpen) {
        const change = interval.close - interval.open;
        return (change / interval.open) * 100.0;
    } else {
        const change = interval.close - interval.low;
        return (change / interval.low) * 100.0;
    }
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

