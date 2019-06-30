
import { StockStats } from "./stock-stats";
import { IQuotes, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";

export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: IQuotes = {};

    constructor(key: string, quotes: string[]= []) {
       this.proxyService = new ProxyService( key );

       this.initializeQuotes(quotes);
    }

    public async getQuotesHistoricalData(): Promise<any> {
        try {
            const promises = [];
            for (const quote of  Object.keys(this.quotes)) {
                const promise = this.proxyService.getHistoricalData(quote).then( (data: any) => {
                    //const quoteIntervals = data[INTERVAL_PROPERTY_NAME] ;
                    //this.quotes[quote].InitializeStockData(quoteIntervals);
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
               this.quotes[quote] = new StockStats(quote);
        });
    }
}