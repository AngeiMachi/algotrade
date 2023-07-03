import { QuoteMonoRunner } from '../engine/quote-mono-reader';

export interface IQuoteFullIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timeIsrael: Date;
    timeNewYork: Date;
    intervalNumber?: number;
    MA10?: number;
    MA20?: number;
    MA50?: number;
}

export interface IQuotes {
    [key: string]: QuoteMonoRunner;
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
    quoteFullYearWeeklyHistory: ITDAmeritradePriceHistory;
    quoteHourlyHistory: ITDAmeritradePriceHistory;
}

export interface ICacheHistoricalData {
    [key: string]: IQuotesHistoricalData;
}

interface IQuotePriceFormat {
    raw: number;
    fmt: string;
}

export interface IQuoteMetadata {
    
    preMarketMetadata: {
        preMarketIntervals: IQuoteIntervals;
        preMarketHOD: IQuoteFullIntervalData;
        preMarketLOD:IQuoteFullIntervalData;
        premarketCloseIntervals:IQuoteFullIntervalData[];
    };
    averageDailyVolume10Day: number | IQuotePriceFormat;
    averageDailyVolume3Month: number | IQuotePriceFormat;
    averageVolatility30Day : number
    average5Minute3Month: number;
    fiftyTwoWeekLow: number | IQuotePriceFormat;
    fiftyTwoWeekHigh: number | IQuotePriceFormat;

    dailyHistoricalData: IQuoteFullIntervalData[];
    fullYearDailyHistory: ITDAmeritradeIntervalData[];
    fullYearWeeklyHistory: ITDAmeritradeIntervalData[];
    hourlyHistory: IQuoteFullIntervalData[];
    previousDay: IQuoteFullIntervalData;
    previousWeek: IQuoteFullIntervalData;
    
    SMA5: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
    };
    SMA10: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
    };
    SMA20: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
    };
    SMA50: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
    };
    SMA100: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
    };
    SMA200: {
        today?: number;
        previousDay: number;
        didOpenOboveSMA?: boolean;
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
    [key: string]: ITDAmeritradeIntervalData;
}

export interface IMarketHours {
    date: string;
    isApiMarketHours: boolean;
    sessionHours: {
        postMarket: {
            start: string;
            end: string;
        };
        preMarket: {
            start: string;
            end: string;
        };
        regularMarket: {
            start: string;
            end: string;
        };
    };
}

export const SessionHoursDefault = {
    postMarket: {
        start: '',
        end: '',
    },
    preMarket: {
        start: '',
        end: '',
    },
    regularMarket: {
        start: '',
        end: '',
    },
};
