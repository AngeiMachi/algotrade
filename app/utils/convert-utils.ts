import moment from 'moment-timezone';
import {
    IMarketHours,
    IQuoteFullIntervalData,
    IQuoteIntervals,
    ITDAmeritradeIntervalData,
    SessionHoursDefault,
} from '../models/quote-data.model';

import { IAlphaVantageIntervals } from '../models/alpha-vantage.model';

export function convertAlphaVantageFormat(stockIntervalData: IAlphaVantageIntervals, key: string): IQuoteFullIntervalData {
    const nasdaqTime = moment.tz(key, 'America/New_York');
    const israelTime = nasdaqTime.clone().tz('Asia/Jerusalem');

    const convertedStockIntervalData: IQuoteFullIntervalData = {
        open: Number(Object.values(stockIntervalData)[0]),
        high: Number(Object.values(stockIntervalData)[1]),
        low: Number(Object.values(stockIntervalData)[2]),
        close: Number(Object.values(stockIntervalData)[3]),
        volume: Number(Object.values(stockIntervalData)[4]),
        timeIsrael: new Date(israelTime.format('YYYY-MM-DD HH:mm:ss')),
        timeNewYork: new Date(nasdaqTime.format('YYYY-MM-DD HH:mm:ss')),
    };

    return convertedStockIntervalData;
}

export function convertAlphaVantageIntervals(alphaVantageIntervals: IAlphaVantageIntervals): IQuoteIntervals {
    const stockIntervals = {} as IQuoteIntervals;

    Object.keys(alphaVantageIntervals).forEach((key) => {
        stockIntervals[key] = convertAlphaVantageFormat(alphaVantageIntervals[key], key);
    });

    return stockIntervals;
}

export function convertYahooIntervals(timestamp: any[], yahooIntervals: any): IQuoteFullIntervalData[] {
    const convertedQuoteIntervalsData: IQuoteFullIntervalData[] = [];

    timestamp &&
        timestamp.forEach((item, index) => {
            const interval: IQuoteFullIntervalData = {
                open: yahooIntervals.open[index],
                high: yahooIntervals.high[index],
                low: yahooIntervals.low[index],
                close: yahooIntervals.close[index],
                volume: yahooIntervals.volume[index],
                timeIsrael: new Date(
                    moment(item * 1000)
                        .tz('Asia/Jerusalem')
                        .format('YYYY-MM-DD HH:mm:ss')
                ),
                timeNewYork: new Date(moment(item * 1000).format('YYYY-MM-DD HH:mm:ss')),
            };
            convertedQuoteIntervalsData.push(interval);
        });

    return convertedQuoteIntervalsData;
}
export function convertTDAmeritrade5MinuteIntervals(intervals: any[]): IQuoteIntervals {
    const convertedQuoteIntervalsData: IQuoteIntervals = {};

    if (intervals && intervals.length > 0) {
        intervals.forEach((item, index) => {
            const key = moment(item.datetime).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
            const interval: IQuoteFullIntervalData = {
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
                timeIsrael: new Date(moment(item.datetime).tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')),
                timeNewYork: new Date(moment(item.datetime).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')),
            };
            convertedQuoteIntervalsData[key] = interval;
        });
    }
    return convertedQuoteIntervalsData;
}

export function convertTDAmeritradeMultipleDaysOf5MinuteIntervals(daysWithInterval: any): { [key: string]: IQuoteIntervals } {
    const convertedQuoteIntervalsMultipleDayData = {} as { [key: string]: IQuoteIntervals };

    Object.keys(daysWithInterval).forEach((key) => {
        convertedQuoteIntervalsMultipleDayData[key] = convertTDAmeritrade5MinuteIntervals(daysWithInterval[key]);
    });

    return convertedQuoteIntervalsMultipleDayData;
}

export function convertTDAmeritradeDailyIntervals(intervals: ITDAmeritradeIntervalData[]): IQuoteFullIntervalData[] {
    const convertedQuoteIntervalsData: IQuoteFullIntervalData[] = [];

    intervals.forEach((item, index) => {
        if(item){
            const interval: IQuoteFullIntervalData = {
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
                timeIsrael: new Date(moment(item.datetime).tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')),
                timeNewYork: new Date(moment(item.datetime).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')),
            };
            convertedQuoteIntervalsData.push(interval);
        }

    });
    return convertedQuoteIntervalsData;
}

export function converTDAmeritradeMarketHours(marketHoursTD: any): IMarketHours {
    const marketHours = {} as IMarketHours;

    const mrkpreS = marketHoursTD.equity.EQ.sessionHours.preMarket[0].start;
    const mrkpreE = marketHoursTD.equity.EQ.sessionHours.preMarket[0].end;
    const mrkS = marketHoursTD.equity.EQ.sessionHours.regularMarket[0].start;
    const mrkE = marketHoursTD.equity.EQ.sessionHours.regularMarket[0].end;
    const mrkpostS = marketHoursTD.equity.EQ.sessionHours.postMarket[0].start;
    const mrkpostE = marketHoursTD.equity.EQ.sessionHours.postMarket[0].end;

    marketHours.date = marketHoursTD.equity.EQ.date;
    marketHours.isApiMarketHours = true;

    marketHours.sessionHours = { ...SessionHoursDefault };

    marketHours.sessionHours.preMarket.start = moment(mrkpreS.substr(0, mrkpreS.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.preMarket.end = moment(mrkpreE.substr(0, mrkpreE.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.regularMarket.start = moment(mrkS.substr(0, mrkS.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.postMarket.start = moment(marketHoursTD.equity.EQ.sessionHours.postMarket.start).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.regularMarket.end = moment(mrkE.substr(0, mrkE.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.postMarket.start = moment(mrkpostS.substr(0, mrkpostS.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');
    marketHours.sessionHours.postMarket.end = moment(mrkpostE.substr(0, mrkpostE.lastIndexOf('-'))).format('YYYY-MM-DD HH:mm:ss');

    return marketHours;
}

export function convertDateToTDMillisecondInterval(date: string): number {
    return moment(date).unix() * 1000;
}

/**
 * Professional Yahoo Finance data converter
 * Handles Yahoo Finance chart data format with proper timezone conversion
 */
export function convertYahooFinanceIntervals(intervals: any[]): IQuoteIntervals {
    const stockIntervals = {} as IQuoteIntervals;

    intervals &&
        intervals.forEach((interval) => {
            // Yahoo Finance provides date objects or ISO strings
            const nasdaqTime = moment(interval.date).tz('America/New_York');
            const israelTime = nasdaqTime.clone().tz('Asia/Jerusalem');
            const key = nasdaqTime.format('YYYY-MM-DD HH:mm:ss');
            
            stockIntervals[key] = {
                open: interval.open || 0,
                high: interval.high || 0,
                low: interval.low || 0,
                close: interval.close || 0,
                volume: interval.volume || 0,
                timeIsrael: new Date(israelTime.format('YYYY-MM-DD HH:mm:ss')),
                timeNewYork: new Date(nasdaqTime.format('YYYY-MM-DD HH:mm:ss')),
            };
        });
    
    return stockIntervals;
}

/**
 * Professional adapter function for TD Ameritrade compatible interval data
 * Converts Yahoo Finance intervals to ITDAmeritradeIntervalData format
 */
export function convertYahooToTDAmeritradeFormat(yahooIntervals: any[]): ITDAmeritradeIntervalData[] {
    return yahooIntervals.map(interval => ({
        open: interval.open || 0,
        high: interval.high || 0,
        low: interval.low || 0,
        close: interval.close || 0,
        volume: interval.volume || 0,
        datetime: moment(interval.date).valueOf() // Convert to milliseconds timestamp
    }));
}

