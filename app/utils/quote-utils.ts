import * as _ from "lodash";
import moment from "moment-timezone";
import * as convertUtils from './convert-utils';
import * as environmentConfig from "../config/environment.Config.json";
import { ITDAmeritradeIntervalData, IQuotesHistoricalData, IQuoteMetadata } from "../models/stock-interval-data.model";
import { convertDateToTDMillisecondInterval } from "./convert-utils";


export function getCurrentTradingDay() {
    let mockDataDate: string;
    if (environmentConfig.Mock.IsMock || environmentConfig.Mock.MockDataDate) {
        mockDataDate = environmentConfig.Mock.MockDataDate;
    } else {
        mockDataDate = moment(new Date()).format("YYYY-MM-DD");
    }

    return mockDataDate;
}

export function calculateAverage(intervals: ITDAmeritradeIntervalData[], currentTime: string, intervalsToAverageBack: number): number {

    const dayBefore= moment(currentTime).subtract(1,"days").format("YYYY-MM-DD");
    const index = getIntervalIndex(intervals, dayBefore );
    if (index > -1) {
        const intervalsForAverage = _.slice(intervals, index - intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, "volume");
        return average;
    }
    return -1;
}
export function getPreviousClose(intervals: ITDAmeritradeIntervalData[], currentTime: string) {
    const dayBefore= moment(currentTime).subtract(1,"days").format("YYYY-MM-DD");
    const index = getIntervalIndex(intervals, dayBefore );
    if (index > -1) {
        return intervals[index].close;
    }
    return -1;
}

export function getPartialHistory(intervals: ITDAmeritradeIntervalData[], currentTime: string | number, 
                                            intervalsToHistoryBack: number):ITDAmeritradeIntervalData[] {                                       
    let index;
    
    if (typeof currentTime === "string") {
        const dayBefore= moment(currentTime).subtract(1,"days").format("YYYY-MM-DD");     
        index = getIntervalIndex(intervals , dayBefore);
    } else {
        const dayBefore = currentTime-86400000; // 86400000 = 24 hours in milliseconds
        index = _.findIndex(intervals, [ "datetime" , dayBefore]);
    }
    if (index > -1) {
        const intervalsBack = _.slice(intervals, index - intervalsToHistoryBack, index);
        return intervalsBack;
    }
    return [];
}

function getIntervalIndex(intervals: ITDAmeritradeIntervalData[], currentTime: string ) {
    // date is 00:00 . TDAmeritrade daily interval is at 08:00 = 28800000 or 07:00 = 25200000
    const currentTimeInMilliseconds = convertDateToTDMillisecondInterval(currentTime);

    let index = _.findIndex(intervals, ["datetime", currentTimeInMilliseconds + 28800000]);
    if (index > -1) {
        return index;
    }
    index = _.findIndex(intervals, ["datetime", currentTimeInMilliseconds + 25200000]);

    return index;
}

export function composeMetadata(historicalData: IQuotesHistoricalData, tradeDay: string): IQuoteMetadata {

    const intervals = historicalData.quoteFullYearDailyHistory.candles;

    const quoteMetadata: IQuoteMetadata = {
        averageDailyVolume10Day: calculateAverage(intervals, tradeDay, 10),
        averageDailyVolume3Month: calculateAverage(intervals, tradeDay, 90),
        regularMarketPreviousClose: getPreviousClose(intervals, tradeDay),

        SMA5: historicalData.SMA,

        // TODO :  put true values
        fiftyTwoWeekLow: 0,
        fiftyTwoWeekHigh: 0,
        dailyHistoricalData: convertUtils.convertTDAmeritradeDailyIntervals(getPartialHistory(intervals, tradeDay, 5)),
    };
    return quoteMetadata;
}