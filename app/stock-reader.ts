import moment from "moment";

import { MAX_QUOTES ,
        INTERVAL_TIME ,
        INTERVAL_PROPERTY_NAME ,
        METADATA_PROPERTY_NAME ,
        LAST_REFRESHED_PROPERTY_NAME,
    } from "./config/globals.config";
import { QuoteStats } from "./stock-stats";
import { IQuotes, IQuoteFullIntervalData, IQuoteMetadata } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { convertAlphaVantageFormat , convertAlphaVantageIntervals } from "./utils/utils";
import { logger } from "./config/winston.config";


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
                const quoteMetadata: IQuoteMetadata = await this.proxyService.getYahooFinanceMetadata(quote) ;
                const promise = this.proxyService.getIntraday(quote).then( (data: any) => {
                    const alphaVantageQuoteIntervals = data[INTERVAL_PROPERTY_NAME] ;
                    const quoteIntervals = convertAlphaVantageIntervals(alphaVantageQuoteIntervals)
                    this.quotes[quote].initializeStockData(quoteIntervals,quoteMetadata);
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
        let  i = 1;
        if  (Object.keys(this.quotes).length > 0) {
            const iterateStockInterval = setInterval( () => {
                this.iterateStocks();
                if  (Object.keys(this.quotes).length === 0) {
                    clearInterval(iterateStockInterval);
                }
            }, INTERVAL_TIME + i++ * 1000);
        } else {
            throw Error("No Stocks were initialized");
        }
    }

    private initializeQuotes(quotes: string[]) {
        const maxFiveQuotes = quotes.slice(0, MAX_QUOTES);
        maxFiveQuotes.forEach( (quote) => {
               this.quotes[quote] = new QuoteStats(quote);
        });
    }

    private iterateStocks() {
        Object.keys(this.quotes).forEach((quote, index) => {
            const quoteStockStats: QuoteStats = this.quotes[quote];
            this.proxyService.getIntraday(quote).then( (data: any) => {

                const stockInterval: IQuoteFullIntervalData = this.getStockLatestIntervalData(data);

                quoteStockStats.recordNewStockInterval(stockInterval, true);
                if (this.isLastInterval(data)) {
                    delete this.quotes[quote];
                    logger.debug("Terminating quote " + quote);
                }
            }).catch( (err) => {
                logger.error("error at Stock-Reader.iterateStocks - quote=" + quote+",index="+index+"err="+err);
            });
        });
    }

    private getStockLatestIntervalData(data: any): IQuoteFullIntervalData {
        const timeSeries = data[ INTERVAL_PROPERTY_NAME ];
        const lastIntervalIndex = data[ METADATA_PROPERTY_NAME ][LAST_REFRESHED_PROPERTY_NAME];
        const stockLastInterval = timeSeries[lastIntervalIndex];
        return convertAlphaVantageFormat(stockLastInterval, lastIntervalIndex );
    }

    private isLastInterval(data: any): boolean {
        return data[ METADATA_PROPERTY_NAME ][ LAST_REFRESHED_PROPERTY_NAME ].includes("16:00");
    }
}
