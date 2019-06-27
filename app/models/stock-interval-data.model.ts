export interface IStockIntervalData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface IStockFullIntervalData extends IStockIntervalData {
    time: Date;
}

export interface IAlphaVantageInterval {
    [key: string]: any;
}
export interface IAlphaVantageIntervals {
    [key: string]: IAlphaVantageInterval;
}
