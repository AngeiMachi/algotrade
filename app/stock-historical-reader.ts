
import { QuoteStats as QuoteStats } from "./stock-stats";
import { IQuotes, IQouteFullIntervalData, IQouteMetadata } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";
import { convertAlphaVantageIntervals } from "./utils/utils";
import { logger } from "./config/winston.config";
import moment = require("moment");

export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: string[] = [];
    private profitLossAccountPerQuote = {} as  {[key:string]:number};

    constructor( quotes: string[] = [], alphaVantagekey: string) {
        this.proxyService = new ProxyService(alphaVantagekey);

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

                        const quoteMetadata: IQouteMetadata = await this.proxyService.getYahooFinanceMetadata(this.quotes[j], moment(tradeDay));

                        const quoteStats = new QuoteStats(this.quotes[j], tradeDay);

                        quoteStats.initializeStockData(quoteIntervals, quoteMetadata);
                    }


                }, j * 15 * 1000);
            }

        } catch (err) {
            Promise.reject(err);
        }
    }

    public async getQuotesHistoricalDataByTDAmeritrade(quoteIndex:number=0): Promise<any> {
        try {
                const historicalData = await this.proxyService.getTDAmeritradeHistoricalData(this.quotes[quoteIndex]);
                const historicalDataTradeDays = Object.keys(historicalData);

                try {
                    for (let i=0; i<historicalDataTradeDays.length; i++) {
                        const tradeDay = historicalDataTradeDays[i];
                        await this.iterateQuoteDays(this.quotes[quoteIndex],i,tradeDay,historicalData[tradeDay]);
                    }
                    logger.debug(this.quotes[quoteIndex] + " Final Profit / Loss:" + this.profitLossAccountPerQuote[this.quotes[quoteIndex]]);
                }  finally {
                    if (quoteIndex+1<this.quotes.length) {
                        this.getQuotesHistoricalDataByTDAmeritrade(quoteIndex+1);
                    }
                }
        } catch (err) {
            Promise.reject(err);
        }
    }

    private async iterateQuoteDays (quote:string,index:number,tradeDay:string ,intervals:any) : Promise<any> {
        let  profitLossAccount :number;
        const quoteMetadata: IQouteMetadata = await this.proxyService.getYahooFinanceMetadata(quote, moment(tradeDay));
        logger.debug("index=" + index + ":" + quote + " Trade Day is " + tradeDay + ":");
        const quoteStats =  new QuoteStats(quote, tradeDay);
        profitLossAccount = quoteStats.initializeStockData(intervals, quoteMetadata);
        if (profitLossAccount!==0) {
            logger.debug("index=" + index + ":" + quote + " Trade Day is " + tradeDay + " Profit / Loss:" +profitLossAccount);
            this.profitLossAccountPerQuote[quote] +=  profitLossAccount;
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes.push(quote);
            this.profitLossAccountPerQuote[quote] = 0;
        });
    }
}
