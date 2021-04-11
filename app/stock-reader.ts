import * as quoteUtils from "./utils/quote-utils";

import { INTERVAL_TIME } from "./config/globals.config";
import { logger } from "./config/winston.config";

import { ProxyService } from "./proxy/proxy-service";
import { QuoteStats } from "./stock-stats";

import { IQuotes,
         IQuoteFullIntervalData,
         IQuoteMetadata,
       } from "./models/stock-interval-data.model";

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
                const promise = this.proxyService.getTDAmeritradeIntraday(quoteKey).then(async (quoteIntervals) => {
                    const quoteMetadata: IQuoteMetadata = await this.proxyService.getMetaDataPerDay(quoteKey,quoteUtils.getCurrentTradingDate(),quoteIntervals);
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
        let i = 0;
        if (Object.keys(this.quotes).length > 0) {
            const iterateStockInterval = setInterval(() => {
                this.iterateStocks();
                if (Object.keys(this.quotes).length === 0) {
                    clearInterval(iterateStockInterval);
                }
            }, INTERVAL_TIME + (i++ * 100));
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
        for (let i = 0; i < Object.keys(this.quotes).length; i++) {
            const quoteKey = Object.keys(this.quotes)[i];
            try {
                const quoteStockStats: QuoteStats = this.quotes[quoteKey];

                const data = await this.proxyService.getTDAmeritradeIntraday(quoteKey);

                const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(data);
                quoteStockStats.recordNewStockInterval(stockInterval, true);

                this.clearQuoteWhenIsLastInterval(quoteKey,stockInterval);
            } catch (err) {
                logger.error("error at Stock-Reader.iterateStocks - quote=" + quoteKey + ",index=" + i + "err=" + err);
            }
        }
    }

    private clearQuoteWhenIsLastInterval(quoteKey: string , interval: IQuoteFullIntervalData) {
        if (this.isLastInterval(interval)) {
            delete this.quotes[quoteKey];
            logger.debug("Terminating quote " + quoteKey);
        }
    }

    private isLastInterval(interval: any): boolean {
        return interval.timeNewYork.getHours() === 16;
    }
}
