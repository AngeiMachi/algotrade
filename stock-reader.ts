import { MAX_QUOTES  } from "./config";
import { StockStats } from "./stock-stats";

interface IQuotes {
    [key: string]: StockStats;
}
export class StockReader {
    private alphaAPI: any;
    private quotes: IQuotes = {};

    constructor(key: string, quotes: string[]= []) {
       this.alphaAPI = require('alphavantage')({ key });

       this.initializeQuotes(quotes);
    }

    /*
     * Re-initialize stocks to watch
     */
    public setStocksToWatch(quotes: string[]) {
        this.initializeQuotes(quotes);
    }

    public initiateStockWatch() {
        if  (Object.keys(this.quotes).length > 0) {
            const interval = setInterval( () => {
                this.iterateStocks();
            }, 50 * 1000);
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
            this.alphaAPI.data.intraday(quote,'compact','json','5min').then( (data:any) => {
                const stockInterval = data["Time Series (5min)"][Object.keys(data["Time Series (5min)"])[1]];
                quoteStockStats.recordNewStockInterval(stockInterval);
            });
        });
    }
}

