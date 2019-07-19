import {QouteStats} from '../stock-stats';

export interface IQouteFullIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: Date;
}

export interface IAlphaVantageInterval {
    [key: string]: any;
}
export interface IAlphaVantageIntervals {
    [key: string]: IAlphaVantageInterval;
}

export interface IQuotes {
    [key: string]: QouteStats;
}
export interface IQouteIntervals {
    [key: string]: IQouteFullIntervalData;
}

interface IQuotePriceFormat {
    raw:number;
    fmt:string;
}

export interface IQouteMetadata {
    averageDailyVolume10Day: IQuotePriceFormat;
    averageDailyVolume3Month: IQuotePriceFormat;
    regularMarketPreviousClose:IQuotePriceFormat;
    fiftyTwoWeekLow: IQuotePriceFormat;
    fiftyTwoWeekHigh: IQuotePriceFormat;

    dailyHistoricalData:IQouteFullIntervalData[];
}