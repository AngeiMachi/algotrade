
import { StockStats } from "./stock-stats";
import { IQuotes, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy-service";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";
import { wait } from "./utils/utils";
import { logger } from "./config/winston.config";

export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: string[] = [];

    constructor(key: string, quotes: string[]= []) {
       this.proxyService = new ProxyService( key );

       this.initializeQuotes(quotes);
    }

    public async getQuotesHistoricalData(): Promise<any> {
        try {
            let hd = [];
            const promises: any[] | Array<Promise<void>> = [];
            for (let j = 0; j < this.quotes.length; j++) {
                const promise = setTimeout(() => {
                     this.proxyService.getHistoricalData(this.quotes[j]).then( (historicalData: any) => {
                        hd = historicalData;
                        for (let i = 0; i < hd.length ; i++) {
                            const quoteIntervals = hd[i][INTERVAL_PROPERTY_NAME] ;
                            const tradeDay = Object.keys(quoteIntervals)[0].substring(0, 10);
                            // console.log("index="+i+":"+this.quotes[0] + " Trade Day is " + tradeDay + ":"  );
                            logger.debug("index=" + i + ":" + this.quotes[j] + " Trade Day is " + tradeDay + ":"  );
                            //logger.info(hd[i]["Time Series (5min)"]);
                            const stockStats = new StockStats(this.quotes[j], tradeDay);
                            stockStats.InitializeStockData(quoteIntervals);
                        }
                    });

                }, j * 15 * 1000);
            }

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
