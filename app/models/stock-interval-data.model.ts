import {QuoteStats} from "../stock-stats";

export interface IQuoteFullIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timeIsrael: Date;
    timeNewYork: Date;
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
}

interface IQuotePriceFormat {
    raw: number;
    fmt: string;
}

export interface IQuoteMetadata {
    averageDailyVolume10Day: number | IQuotePriceFormat;
    averageDailyVolume3Month: number | IQuotePriceFormat;
    average5Minute3Month:number;
    previousClose: number | IQuotePriceFormat;
    fiftyTwoWeekLow: number | IQuotePriceFormat;
    fiftyTwoWeekHigh: number | IQuotePriceFormat;

    dailyHistoricalData: IQuoteFullIntervalData[];
    fullYearDailyHistory: ITDAmeritradeIntervalData[];
    SMA5: {
        today:number,
        previousDay:number
    };
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

export interface ITDAmeritradeIntervals {
    [key:string]:ITDAmeritradeIntervalData;
}
