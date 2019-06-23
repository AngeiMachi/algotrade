// tslint:disable-next-line: ordered-imports
import { MAX_QUOTES , INTERVAL_TIME , INTERVAL_PROPERTY_NAME } from "./config";
import { StockStats } from "./stock-stats";
// tslint:disable-next-line: ordered-imports
import { IStockIntervalData } from "./models/stock-interval-data.model";
import moment from "moment";

interface IQuotes {
    [key: string]: StockStats;
}
interface IStockIntervals {
    [key: string]: IStockIntervalData;
}

export class StockReader {
    private alphaAPI: any;
    private quotes: IQuotes = {};

    constructor(key: string, quotes: string[]= []) {
       this.alphaAPI = require("alphavantage")({ key });

       this.initializeQuotes(quotes);
    }

    public initializeQuotesData() {

        for (const quote of  Object.keys(this.quotes)) {
            this.alphaAPI.data.intraday(quote, "compact", "json", "5min").then( (data: any) => {
                const quoteIntervals = data[INTERVAL_PROPERTY_NAME] ;
                this.quotes[quote].InitializeStockData(quoteIntervals);
            });
            break;
        }
    }

    public initiateStockWatch() {
        if  (Object.keys(this.quotes).length > 0) {
            const interval = setInterval( () => {
                this.iterateStocks();
            }, INTERVAL_TIME);
        } else {
            throw Error("No Stocks were initialized");
        }
    }

    private initializeQuotes(quotes: string[]) {
        const maxFiveQuotes = quotes.slice(0, MAX_QUOTES);
        maxFiveQuotes.forEach( (quote) => {
               this.quotes[quote] = new StockStats(quote);
        });
    }

    private iterateStocks() {
        Object.keys(this.quotes).forEach((quote) => {
            const quoteStockStats: StockStats = this.quotes[quote];
            this.alphaAPI.data.intraday(quote, "compact", "json", "5min").then( (data: any) => {
                const stockInterval: IStockIntervalData = this.getStockLastIntervalData(data);
                quoteStockStats.recordNewStockInterval(stockInterval);
            });
        });
    }

    private getStockLastIntervalData(data: any): IStockIntervalData {
        const timeSeries = data[ INTERVAL_PROPERTY_NAME ];
        const stockLastInterval = timeSeries[Object.keys(timeSeries)[Object.keys.length - 1]];
        return this.convertAlphaVantageFormat(stockLastInterval);
    }

    private convertAlphaVantageFormat(stockIntervalData: any): IStockIntervalData {
        const convertedStockIntervalData: IStockIntervalData = {
            open :  Number(Object.values(stockIntervalData)[0]) ,
            high :  Number(Object.values(stockIntervalData)[1]),
            low :  Number(Object.values(stockIntervalData)[2]),
            close :  Number(Object.values(stockIntervalData)[3]),
            volume :  Number(Object.values(stockIntervalData)[4]),
        };

        return convertedStockIntervalData;
    }

}
