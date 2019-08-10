import {QuoteStats} from "../stock-stats";

export interface IQuoteFullIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: Date;
}

export interface IQuotes {
    [key: string]: QuoteStats;
}
export interface IQuoteIntervals {
    [key: string]: IQuoteFullIntervalData;
}
export interface IQuoteHistoricalIntervals {
    [key: string]: IQuoteIntervals;
}
export interface IQuotesHistoricalData {
    quote5MinuteHistory?: IQuoteHistoricalIntervals;
    quoteFullYearDailyHistory: ITDAmeritradePriceHistory;
    SMA: any;
}

interface IQuotePriceFormat {
    raw: number;
    fmt: string;
}

export interface IQuoteMetadata {
    averageDailyVolume10Day: number | IQuotePriceFormat;
    averageDailyVolume3Month: number | IQuotePriceFormat;
    regularMarketPreviousClose: number | IQuotePriceFormat;
    fiftyTwoWeekLow: number | IQuotePriceFormat;
    fiftyTwoWeekHigh: number | IQuotePriceFormat;

    dailyHistoricalData: IQuoteFullIntervalData[];

    SMA5?: any;
}

export interface ITDAmeritradePriceHistory {
    candles: ITDAmeritradeIntervalData[];
    symbol: string;
    empty: boolean;
}

export interface ITDAmeritradeIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    datetime: number;
}
