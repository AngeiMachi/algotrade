import * as environmentConfig from "./../config/environment.Config.json";
import moment from "moment-timezone";
import { IAlphaVantageIntervals , IStockFullIntervalData, IStockIntervals } from "../models/stock-interval-data.model";

export function getCurrentTradingDay() {
    let mockDataDate: string;
    if (environmentConfig.Mock.IsMock || environmentConfig.Mock.MockDataDate) {
        mockDataDate = environmentConfig.Mock.MockDataDate;
    } else {
        mockDataDate = moment(new Date()).format("YYYY-MM-DD");
    }

    return mockDataDate;
}

export function convertAlphaVantageFormat(stockIntervalData: IAlphaVantageIntervals, key: string): IStockFullIntervalData {
    const nasdaqTime = moment.tz(key, "America/New_York");
    const israelTime = nasdaqTime.clone().tz("Asia/Jerusalem");

    const convertedStockIntervalData: IStockFullIntervalData = {
        open :  Number(Object.values(stockIntervalData)[0]) ,
        high :  Number(Object.values(stockIntervalData)[1]),
        low :  Number(Object.values(stockIntervalData)[2]),
        close :  Number(Object.values(stockIntervalData)[3]),
        volume :  Number(Object.values(stockIntervalData)[4]),
        time: new Date( israelTime.format("YYYY-MM-DD HH:mm:ss") ),
    };

    return convertedStockIntervalData;
}

export function convertAlphaVantageIntervals(alphaVantageIntervals:IAlphaVantageIntervals): IStockIntervals  {

    const stockIntervals  = {} as IStockIntervals;

    Object.keys(alphaVantageIntervals).forEach((key) => {
        stockIntervals[key] = convertAlphaVantageFormat(alphaVantageIntervals[key], key) ;
    });

    return stockIntervals;
}