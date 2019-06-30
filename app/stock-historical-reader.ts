
import { StockStats } from "./stock-stats";
import { IQuotes, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";
import { wait } from "./utils/utils";

export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: string[] = [];

    constructor(key: string, quotes: string[]= []) {
       this.proxyService = new ProxyService( key );

       this.initializeQuotes(quotes);
    }

    public async getQuotesHistoricalData(): Promise<any> {
        try {
            const promises: any[] | Array<Promise<void>> = [];
            for (const quote of  this.quotes) {
                const promise = this.proxyService.getHistoricalData(quote).then( (historicalData: any) => {
                    historicalData.forEach(( data: any ) => {
                        const quoteIntervals = data[INTERVAL_PROPERTY_NAME] ;
                        const tradeDay = Object.keys(quoteIntervals)[0].substring(0, 10);
                        console.log(quote + " Trade Day is " + tradeDay + ":");
                        const stockStats = new StockStats(quote, tradeDay);
                        stockStats.InitializeStockData(quoteIntervals);
                    });
                });
                promises.push( promise );

            }
            await Promise.all(promises);
            return Promise.resolve();
        } catch (err) {
            Promise.reject(err);
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach( (quote) => {
               this.quotes.push(quote);
        });
    }
}