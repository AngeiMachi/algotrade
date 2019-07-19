
import { QouteStats as QuoteStats } from "./stock-stats";
import { IQuotes, IQouteFullIntervalData, IQouteMetadata } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";
import { convertAlphaVantageIntervals } from "./utils/utils";
import { logger } from "./config/winston.config";
import moment = require("moment");

export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: string[] = [];

    constructor(key: string, quotes: string[] = []) {
        this.proxyService = new ProxyService(key);

        this.initializeQuotes(quotes);
    }

    public async getQuotesHistoricalDataByAlphaVantage(): Promise<any> {
        try {
            const promises: any[] | Array<Promise<void>> = [];
            for (let j = 0; j < this.quotes.length; j++) {
                const promise = setTimeout(async () => {
                    const historicalData = await this.proxyService.getAlphaVantageHistoricalData(this.quotes[j])

                    for (let i = 0; i < historicalData.length; i++) {
                        const alphaVantageQuoteIntervals = historicalData[i][INTERVAL_PROPERTY_NAME];
                        const tradeDay = Object.keys(alphaVantageQuoteIntervals)[0].substring(0, 10);

                        logger.debug("index=" + i + ":" + this.quotes[j] + " Trade Day is " + tradeDay + ":");

                        const quoteIntervals = convertAlphaVantageIntervals(alphaVantageQuoteIntervals);

                        const quoteMetadata: IQouteMetadata = await this.proxyService.getYahooFinanceMetadata(this.quotes[j],moment(tradeDay)) ;

                        const quoteStats = new QuoteStats(this.quotes[j], tradeDay);
                        
                        quoteStats.initializeStockData(quoteIntervals,quoteMetadata);
                    }


                }, j * 15 * 1000);
            }

        } catch (err) {
            Promise.reject(err);
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes.push(quote);
        });
    }
}
