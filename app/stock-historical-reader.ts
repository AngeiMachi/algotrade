
import { QuoteStats as QuoteStats } from "./stock-stats";
import { IQuotes, IQouteFullIntervalData, IQouteMetadata, IQuotesHistoricalsData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";
import { convertAlphaVantageIntervals } from "./utils/utils";
import { logger } from "./config/winston.config";
import moment = require("moment");
import  * as quoteUtils  from "./utils/quoteUtils";

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
                const currentQuote = this.quotes[quoteIndex];

                const historicalData: IQuotesHistoricalsData = await this.proxyService.getHistoricalData(this.quotes[quoteIndex]);
                const {quote5MinuteHistory} = historicalData;
                const historicalIntervalsTradeDays = Object.keys(quote5MinuteHistory);

                try {
                    for (let i=0; i<historicalIntervalsTradeDays.length; i++) {
                        const tradeDay = historicalIntervalsTradeDays[i];
                        logger.debug("index=" + i + ":" + currentQuote + " Trade Day is " + tradeDay + ":");
                        
                        const profitLossAccount = this.calculateProfitLossPerTradeDay (historicalData,currentQuote,tradeDay);

                        if (profitLossAccount!==0) {
                            logger.debug("index=" +  i + ":" + this.quotes[quoteIndex] + " Trade Day is " + tradeDay + " Profit / Loss:" + profitLossAccount);
                            this.profitLossAccountPerQuote[currentQuote] +=  profitLossAccount;
                        }
                    }
                    logger.debug(currentQuote + " Final Profit / Loss:" + this.profitLossAccountPerQuote[currentQuote]);
                }  finally {
                    if (quoteIndex+1<this.quotes.length) {
                        this.getQuotesHistoricalDataByTDAmeritrade(quoteIndex+1);
                    }
                }
        } catch (err) {
            logger.error("getQuotesHistoricalDataByTDAmeritrade :" + err);
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes.push(quote);
            this.profitLossAccountPerQuote[quote] = 0;
        });
    }

    private composeMetadata(historicalData: IQuotesHistoricalsData,tradeDay:string) :IQouteMetadata {

        const intervals = historicalData.quoteFullYearDailyHistory.candles;
        
        let quoteMetadata: IQouteMetadata = {
            averageDailyVolume10Day: quoteUtils.calculateAverage(intervals,tradeDay,10),
            averageDailyVolume3Month: quoteUtils.calculateAverage(intervals,tradeDay,90),
            regularMarketPreviousClose: quoteUtils.getPreviousClose(intervals,tradeDay),
            
            SMA5:historicalData.SMA,
            
            // TODO :  put true values 
            fiftyTwoWeekLow:0,
            fiftyTwoWeekHigh:0,
            dailyHistoricalData: [],
        }
        return quoteMetadata;
    }

     private calculateProfitLossPerTradeDay (historicalData:any, currentQuote:string,tradeDay:string)  { 
         
        const quote5MinuteHistory = historicalData.quote5MinuteHistory;
        const quoteMetadata = this.composeMetadata(historicalData,tradeDay);
        const quoteStats =  new QuoteStats(currentQuote, tradeDay);
        const profitLossAccount = quoteStats.initializeStockData(quote5MinuteHistory[tradeDay], quoteMetadata); 

        return profitLossAccount;
    }
}
