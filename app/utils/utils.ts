import * as environmentConfig from "./../config/environment.Config.json";
import moment from "moment-timezone";
import { IAlphaVantageIntervals , IQouteFullIntervalData, IQouteIntervals } from "../models/stock-interval-data.model";

export function getCurrentTradingDay() {
    let mockDataDate: string;
    if (environmentConfig.Mock.IsMock || environmentConfig.Mock.MockDataDate) {
        mockDataDate = environmentConfig.Mock.MockDataDate;
    } else {
        mockDataDate = moment(new Date()).format("YYYY-MM-DD");
    }

    return mockDataDate;
}

export function convertAlphaVantageFormat(stockIntervalData: IAlphaVantageIntervals, key: string): IQouteFullIntervalData {
    const nasdaqTime = moment.tz(key, "America/New_York");
    const israelTime = nasdaqTime.clone().tz("Asia/Jerusalem");

    const convertedStockIntervalData: IQouteFullIntervalData = {
        open :  Number(Object.values(stockIntervalData)[0]) ,
        high :  Number(Object.values(stockIntervalData)[1]),
        low :  Number(Object.values(stockIntervalData)[2]),
        close :  Number(Object.values(stockIntervalData)[3]),
        volume :  Number(Object.values(stockIntervalData)[4]),
        time: new Date( israelTime.format("YYYY-MM-DD HH:mm:ss") ),
    };

    return convertedStockIntervalData;
}

export function convertAlphaVantageIntervals(alphaVantageIntervals:IAlphaVantageIntervals): IQouteIntervals  {

    const stockIntervals  = {} as IQouteIntervals;

    Object.keys(alphaVantageIntervals).forEach((key) => {
        stockIntervals[key] = convertAlphaVantageFormat(alphaVantageIntervals[key], key) ;
    });

    return stockIntervals;
}

export function convertYahooIntervals(timestamp:any[], yahooIntervals:any) : IQouteFullIntervalData[]{
    const convertedQuoteIntervalsData: IQouteFullIntervalData[] = [];

    timestamp.forEach((item, index) => {
        const interval :IQouteFullIntervalData = {
            open:yahooIntervals.open[index],
            high:yahooIntervals.high[index],
            low:yahooIntervals.low[index],
            close:yahooIntervals.close[index],
            volume: yahooIntervals.volume[index],
            time: new Date(moment(item*1000).tz("Asia/Jerusalem").format("YYYY-MM-DD HH:mm:ss"))
        }
        convertedQuoteIntervalsData.push(interval)
    });

    return convertedQuoteIntervalsData;
}
export function convertTDAmeritrade5MinuteIntervals(intervals:any[]) : IQouteIntervals {
    const convertedQuoteIntervalsData: IQouteIntervals = {};

    intervals.forEach((item, index) => {
        const interval :IQouteFullIntervalData = {
            open:item.open,
            high:item.high,
            low:item.low,
            close:item.close,
            volume: item.volume,
            time: new Date(moment(item.datetime).add(5,"minutes").tz("Asia/Jerusalem").format("YYYY-MM-DD HH:mm:ss"))
        }
        convertedQuoteIntervalsData[moment(item.datetime).add(5,"minutes").tz("America/New_York").format("YYYY-MM-DD HH:mm:ss")] =  interval;
    });

    return convertedQuoteIntervalsData;
}

export function convertTDAmeritradeMultipleDaysOf5MinuteIntervals(daysWithInterval:any) : {[key: string]:IQouteIntervals}  {
    const convertedQuoteIntervalsMultipleDayData  = {} as {[key: string]:IQouteIntervals};

    Object.keys(daysWithInterval).forEach((key)=>{
        convertedQuoteIntervalsMultipleDayData[key] = convertTDAmeritrade5MinuteIntervals(daysWithInterval[key]);
    });

    return convertedQuoteIntervalsMultipleDayData;
}
