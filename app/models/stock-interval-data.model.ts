import {QuoteStats} from '../stock-stats';

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
    [key: string]: QuoteStats;
}
export interface IQouteIntervals {
    [key: string]: IQouteFullIntervalData;
}
export interface IQouteHistoricalIntervals {
    [key: string]: IQouteIntervals;
}
export interface IQuotesHistoricalsData {
    quote5MinuteHistory:IQouteHistoricalIntervals;
    quoteFullYearDailyHistory:ITDAmeritradePriceHistory;
    SMA: any;
}

interface IQuotePriceFormat {
    raw:number;
    fmt:string;
}

export interface IQouteMetadata {
    averageDailyVolume10Day: number | IQuotePriceFormat;
    averageDailyVolume3Month: number | IQuotePriceFormat;
    regularMarketPreviousClose:number | IQuotePriceFormat;
    fiftyTwoWeekLow: number | IQuotePriceFormat;
    fiftyTwoWeekHigh: number | IQuotePriceFormat;

    dailyHistoricalData:IQouteFullIntervalData[];

    SMA5?:any;
}

export interface ITDAmeritradePriceHistory {
    candles: ITDAmeritradeIntervalData[];
    symbol:string;
    empty:boolean;
}

export interface ITDAmeritradeIntervalData {
    open:number;
    high:number;
    low:number;
    close:number;
    volume:number;
    datetime:number;
}