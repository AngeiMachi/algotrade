
import moment from "moment";

import { MAX_QUOTES ,
        INTERVAL_TIME ,
        INTERVAL_PROPERTY_NAME ,
        METADATA_PROPERTY_NAME ,
        LAST_REFRESHED_PROPERTY_NAME,
    } from "./config/globals.config";
import { StockStats } from "./stock-stats";
import { IQuotes, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { convertAlphaVantageFormat } from "./utils/utils";


export class StockReader {
    private proxyService: ProxyService;
    private quotes: IQuotes = {};

    constructor(key: string, quotes: string[]= []) {
       this.proxyService = new ProxyService( key );

       this.initializeQuotes(quotes);
    }

    public async initializeQuotesData(): Promise<any> {
        try {
            const promises = [];
            for (const quote of  Object.keys(this.quotes)) {
                const promise = this.proxyService.getIntraday(quote).then( (data: any) => {
                    const quoteIntervals = data[INTERVAL_PROPERTY_NAME] ;
                    this.quotes[quote].InitializeStockData(quoteIntervals);
                });
                promises.push( promise );
            }
            await Promise.all(promises);
            return Promise.resolve();
        } catch (err) {
            Promise.reject(err);
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
            this.proxyService.getIntraday(quote).then( (data: any) => {
                const stockInterval: IStockFullIntervalData = this.getStockLatestIntervalData(data);
                quoteStockStats.recordNewStockInterval(stockInterval);
                if (this.isLastInterval(data)) {
                    delete this.quotes[quote];
                    console.log("Terminating quote " + quote);
                }
            });
        });
    }

    private getStockLatestIntervalData(data: any): IStockFullIntervalData {
        const timeSeries = data[ INTERVAL_PROPERTY_NAME ];
        const lastIntervalIndex = data[ METADATA_PROPERTY_NAME ][LAST_REFRESHED_PROPERTY_NAME];
        const stockLastInterval = timeSeries[lastIntervalIndex];
        return convertAlphaVantageFormat(stockLastInterval, lastIntervalIndex );
    }

    private isLastInterval(data: any): boolean {
        return data[ METADATA_PROPERTY_NAME ][ LAST_REFRESHED_PROPERTY_NAME ].includes("16:00");
    }
}
