import { AsyncRevolver } from "async-revolver";
import * as environmentConfig from "./config/environment.Config.json";
import { convertAlphaVantageFormat, convertAlphaVantageIntervals } from "./utils/convert-utils";
import * as quoteUtils from "./utils/quote-utils";
import {
    INTERVAL_TIME,
    INTERVAL_PROPERTY_NAME,
    METADATA_PROPERTY_NAME,
    LAST_REFRESHED_PROPERTY_NAME,
} from "./config/globals.config";
import { QuoteStats } from "./stock-stats";
import { IQuotes, IQuoteFullIntervalData, IQuoteMetadata } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy/proxy-service";
import { logger } from "./config/winston.config";


export class StockReader {
    private proxyService: ProxyService;
    private quotes: IQuotes = {};


    constructor( quotes: string[] = []) {
        

        this.proxyService = new ProxyService();

        this.initializeQuotes(quotes);

        
    }

    public async initializeQuotesData(): Promise<any> {
        try {
            const promises = [];

            for (let i = 0; i < Object.keys(this.quotes).length; i++) {
                const quoteKey = Object.keys(this.quotes)[i];
                const quoteMetadata: IQuoteMetadata = await this.proxyService.getMetaDataPerDay(quoteKey,quoteUtils.getCurrentTradingDay());
                const promise = this.proxyService.getIntraday(quoteKey).then((data: any) => {
                    const alphaVantageQuoteIntervals = data[INTERVAL_PROPERTY_NAME];
                    const quoteIntervals = convertAlphaVantageIntervals(alphaVantageQuoteIntervals)
                    this.quotes[quoteKey].initializeStockData(quoteIntervals, quoteMetadata);
                });
                promises.push(promise);
            }
            await Promise.all(promises);
            return Promise.resolve();
        } catch (err) {
            Promise.reject(err);
        }
    }

    public initiateStockWatch() {
        let i = 1;
        if (Object.keys(this.quotes).length > 0) {
            const iterateStockInterval = setInterval(() => {
                this.iterateStocks();
                if (Object.keys(this.quotes).length === 0) {
                    clearInterval(iterateStockInterval);
                }
            }, INTERVAL_TIME + (i++ * 1000));
        } else {
            throw Error("No Stocks were initialized");
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes[quote] = new QuoteStats(quote);
        });
    }

    private async iterateStocks() {
        for (let i = 0; Object.keys(this.quotes).length; i++) {
            const quoteKey = Object.keys(this.quotes)[i];
            try {
                const quoteStockStats: QuoteStats = this.quotes[quoteKey];

                const data = await this.proxyService.getIntraday(quoteKey);

                const stockInterval: IQuoteFullIntervalData = this.getStockLatestIntervalData(data);
                quoteStockStats.recordNewStockInterval(stockInterval, true);

                this.clearQuoteWhenIsLastInterval(quoteKey,data);
            } catch (err) {
                logger.error("error at Stock-Reader.iterateStocks - quote=" + quoteKey + ",index=" + i + "err=" + err);
            }
        }
    }

    private getStockLatestIntervalData(data: any): IQuoteFullIntervalData {
        const timeSeries = data[INTERVAL_PROPERTY_NAME];
        const lastIntervalIndex = data[METADATA_PROPERTY_NAME][LAST_REFRESHED_PROPERTY_NAME];
        const stockLastInterval = timeSeries[lastIntervalIndex];
        return convertAlphaVantageFormat(stockLastInterval, lastIntervalIndex);
    }

    private clearQuoteWhenIsLastInterval(quoteKey: string , data: any) {
        if (this.isLastInterval(data)) {
            delete this.quotes[quoteKey];
            logger.debug("Terminating quote " + quoteKey);
        }
    }

    private isLastInterval(data: any): boolean {
        return data[METADATA_PROPERTY_NAME][LAST_REFRESHED_PROPERTY_NAME].includes("16:00");
    }
}
