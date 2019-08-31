import * as _ from "lodash";
import moment from "moment-timezone";

import * as globalConfig from "../config/globals.config";
import { logger } from "../config/winston.config";

import * as convertUtils from './convert-utils';
import { convertDateToTDMillisecondInterval } from "./convert-utils";

import { ITDAmeritradeIntervalData,
         IQuotesHistoricalData,
         IQuoteMetadata, 
         IQuoteIntervals,
         IQuoteFullIntervalData
       } from "../models/stock-interval-data.model";

export function getCurrentTradingDate() {
    let mockDataDate: string;
    if (globalConfig.Mock.IsMock || globalConfig.Mock.MockDataDate) {
        mockDataDate = globalConfig.Mock.MockDataDate;
    } else {
        mockDataDate = moment(new Date()).format("YYYY-MM-DD");
    }

    return mockDataDate;
}

export function getPreviousTradingDate(tradingDate: string | number) {
    let substractDays:number=1;
    if (moment(tradingDate).day()==1) {
        substractDays=3;
    }
    else if (moment(tradingDate).day()==0) {
        substractDays=2;
    }
    if (typeof tradingDate === "string") {
        return moment(tradingDate).subtract(substractDays, "days").format("YYYY-MM-DD");
    }
   return substractDays - (86400000*substractDays); // 86400000 = 24 hours in milliseconds
}



export function calculateAverage(intervals: ITDAmeritradeIntervalData[], tradingDate: string, intervalsToAverageBack: number): number {
    const dayBefore = getPreviousTradingDate(tradingDate) as string;
    const index = getLastTradingDateIndex(intervals, dayBefore );
    if (index > -1) {
        const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, "volume");
        return average;
    }
    return -1;
}

export function calculateMovingAverage(intervals: ITDAmeritradeIntervalData[], tradingDate: string,
                                       intervalsToAverageBack: number,firstIntradayInterval?: IQuoteFullIntervalData, type:"open" | "close"="close"): number {
    
    const firstIntradayIntervalCopy = {...firstIntradayInterval}  as IQuoteFullIntervalData;                  
    if (firstIntradayInterval) {
        const index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate)  as string);
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack+1 , index+1 );
            const average = _.meanBy([...intervalsForAverage,firstIntradayIntervalCopy], type);
            return average;
        }
    }
    else {
        const index = getIntervalIndex(intervals, getPreviousTradingDate(tradingDate)  as string );
        if (index > -1) {
            const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack + 1, index + 1);
            const average = _.meanBy(intervalsForAverage, type);
            return average;
        }
    }
    return -1;
}

export function getPreviousClose(intervals: ITDAmeritradeIntervalData[], tradingDate: string) {
    const dayBefore = getPreviousTradingDate(tradingDate) as string;
    const index = getLastTradingDateIndex(intervals, dayBefore );
    if (index > -1) {
        return intervals[index].close;
    }
    return -1;
}

export function getPartialHistory(intervals: ITDAmeritradeIntervalData[], tradingDate: string | number,
                                  intervalsToHistoryBack: number): ITDAmeritradeIntervalData[] {
    let index;

    if (typeof tradingDate === "string") {
        const dayBefore = getPreviousTradingDate(tradingDate) as string;
        index = getIntervalIndex(intervals , dayBefore);
    } else {
        const dayBefore = getPreviousTradingDate(tradingDate);
        index = _.findIndex(intervals, [ "datetime" , dayBefore]);
    }
    if (index > -1) {
        const intervalsBack = _.slice(intervals, index - intervalsToHistoryBack, index);
        return intervalsBack;
    }
    return [];
}

function getIntervalIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string ) {
    
    // date is 00:00 . TDAmeritrade daily interval is at 08:00 = 28800000 or 07:00 = 25200000
    const currentTimeInMilliseconds = convertDateToTDMillisecondInterval(tradingDate);

    if (currentTimeInMilliseconds<intervals[0].datetime || currentTimeInMilliseconds>intervals[intervals.length -1].datetime) {
        logger.error("Quote-Utils.getIntervalIndex interval out of bounds");
        throw "interval out of bounds";

    }

    let index = _.findIndex(intervals, ["datetime", currentTimeInMilliseconds + 28800000]);
    if (index > -1) {
        return index;
    }
    index = _.findIndex(intervals, ["datetime", currentTimeInMilliseconds + 25200000]);

    return index;
}

function getLastTradingDateIndex(intervals: ITDAmeritradeIntervalData[], tradingDate: string ) {
    let lastTradingDateIndex = -1
    let lastTradingDate = tradingDate
    while (lastTradingDateIndex===-1) {
        lastTradingDateIndex = getIntervalIndex(intervals,lastTradingDate );
        lastTradingDate = moment(lastTradingDate).subtract(1,"days").format("YYYY-MM-DD")
    }

    return lastTradingDateIndex;
}

export function composeMetadata(tradingDate: string, historicalData: IQuotesHistoricalData, firstInterval?: IQuoteFullIntervalData): IQuoteMetadata {

    const intervals = historicalData.quoteFullYearDailyHistory.candles;

    const quoteMetadata: IQuoteMetadata = {
        averageDailyVolume10Day: calculateAverage(intervals, tradingDate, 10),
        averageDailyVolume3Month: calculateAverage(intervals, tradingDate, 90),
        get average5Minute3Month() {
            return ((this.averageDailyVolume3Month as number)/78);
        },
        previousClose: getPreviousClose(intervals, tradingDate),

        SMA5: {
            today:calculateMovingAverage(intervals, tradingDate, 5,firstInterval),
            previousDay:calculateMovingAverage(intervals, tradingDate, 5)
        },

        // TODO :  put true values
        fiftyTwoWeekLow: 0,
        fiftyTwoWeekHigh: 0,

        fullYearDailyHistory: historicalData.quoteFullYearDailyHistory.candles,
        dailyHistoricalData: convertUtils.convertTDAmeritradeDailyIntervals(getPartialHistory(intervals, tradingDate,10)),
    };
    return quoteMetadata;
}

export function getRecentIntervalData( intervals: IQuoteIntervals ) {
    return intervals[Object.keys(intervals)[Object.keys(intervals).length-1]];
}

export function getRecentFirstIntervalData( intervals: IQuoteIntervals ) {
    return intervals[Object.keys(intervals)[0]];
}
