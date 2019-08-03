import * as _ from "lodash";
import moment = require("moment");
import { AsyncRevolver } from "async-revolver";

import * as environmentConfig from "./config/environment.Config.json";
import { logger } from "./config/winston.config";
import { INTERVAL_PROPERTY_NAME } from "./config/globals.config";

import { QuoteStats as QuoteStats } from "./stock-stats";
import { IQuoteMetadata, IQuotesHistoricalData } from "./models/stock-interval-data.model";
import { ProxyService } from "./proxy/proxy-service";

import { convertAlphaVantageIntervals } from "./utils/convert-utils";
import * as quoteUtils from "./utils/quote-utils";


export class StockHistoricalReader {
    private proxyService: ProxyService;
    private quotes: string[] = [];
    private profitLossAccountPerQuote = {} as { [key: string]: number };
    
    constructor(quotes: string[] = []) {
        this.proxyService = new ProxyService();

        this.initializeQuotes(quotes);
    }

    public async getQuotesHistoricalDataByAlphaVantage(): Promise<any> {
        try {
            const promises: any[] | Array<Promise<void>> = [];
            for (let j = 0; j < this.quotes.length; j++) {
                const promise = setTimeout(async () => {
                    const historicalData = await this.proxyService.getAlphaVantageHistoricalData(this.quotes[j]);

                    for (let i = 0; i < historicalData.length; i++) {
                        const alphaVantageQuoteIntervals = historicalData[i][INTERVAL_PROPERTY_NAME];
                        const tradeDay = Object.keys(alphaVantageQuoteIntervals)[0].substring(0, 10);

                        logger.debug("index=" + i + ":" + this.quotes[j] + " Trade Day is " + tradeDay + ":");

                        const quoteIntervals = convertAlphaVantageIntervals(alphaVantageQuoteIntervals);

                        const quoteMetadata: IQuoteMetadata = await this.proxyService.getYahooFinanceMetadata(this.quotes[j],
                                                                                                              moment(tradeDay));

                        const quoteStats = new QuoteStats(this.quotes[j], tradeDay);

                        quoteStats.initializeStockData(quoteIntervals, quoteMetadata);
                    }

                }, j * 15 * 1000);
            }

        } catch (err) {
            Promise.reject(err);
        }
    }

    public async getQuotesHistoricalDataByTDAmeritrade(quoteIndex: number = 0, specificTradeDates: string[]= []): Promise<any> {
        try {
            const currentQuote = this.quotes[quoteIndex];

            const historicalData: IQuotesHistoricalData = await this.proxyService.getHistoricalData(this.quotes[quoteIndex],
                                                                                                         specificTradeDates);
            const { quote5MinuteHistory } = historicalData;
            const historicalIntervalsTradeDays = Object.keys(quote5MinuteHistory as object);

            try {
                let loosingTrade = 0;
                let winningTrades = 0;
                let loosingSum = 0;
                let winningSum = 0;
                for (let i = 0; i < historicalIntervalsTradeDays.length; i++) {
                    const tradeDay = historicalIntervalsTradeDays[i];
                    logger.debug("index=" + i + ":" + currentQuote + " Trade Day is " + tradeDay + ":");

                    const profitLossAccount = this.calculateProfitLossPerTradeDay(historicalData, currentQuote, tradeDay);

                    if (profitLossAccount !== 0) {
                        if (profitLossAccount > 0) {
                            winningTrades++;
                            winningSum += profitLossAccount;
                        } else if (profitLossAccount < 0) {
                            loosingTrade++;
                            loosingSum += profitLossAccount;
                        }
                        logger.debug("index=" + i + ":" + this.quotes[quoteIndex] + " Trade Day is " +
                            tradeDay + " Profit / Loss:" + profitLossAccount);
                        this.profitLossAccountPerQuote[currentQuote] += profitLossAccount;
                    }
                }
                logger.debug("----------------------------------------------------------------------------");
                logger.debug("Loosing trades=" + loosingTrade + "(" + loosingSum.toFixed(2) +
                            ")  ,Winning trades=" + winningTrades +  "(" + winningSum.toFixed(2) + ")");
                logger.debug("----------------------------------------------------------------------------");
                logger.debug(currentQuote + " Final Profit / Loss:" + this.profitLossAccountPerQuote[currentQuote].toFixed(2) +
                ". Success Ratio:" + (winningTrades / loosingTrade ).toFixed(2));
            } finally {
                if (quoteIndex + 1 < this.quotes.length) {
                    this.getQuotesHistoricalDataByTDAmeritrade(quoteIndex + 1, specificTradeDates);
                } else {
                    logger.debug("(-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-:  (-: ");
                }
            }
        } catch (err) {
            logger.error("getQuotesHistoricalDataByTDAmeritrade :" + err);
        }

        logger.debug("----------------------------------------------------------------------------");
    }

    public async getBiggestDailyMoves(BiggestMoversQuota: number) {
        logger.debug("Biggest Moves:");
        logger.debug("-------------------");
        for (let i = 0; i < this.quotes.length; i++) {
            logger.debug(this.quotes[i]);
            logger.debug("----------------------------------------------------------------------------");
            const { partialHistoryDailyIntervals,
                    fullYearDailyHistory } = await this.proxyService.getTDAmeritradeDailyHistory(this.quotes[i], 100);
            const quoteMoves = partialHistoryDailyIntervals.map((item) => {
                const tradeDay = moment(item.time).format("YYYY-MM-DD");
                return {
                    diff: + (item.high - item.low).toFixed(2),
                    ...item,
                    time: tradeDay,
                    avg10Days: quoteUtils.calculateAverage(fullYearDailyHistory.candles, tradeDay, 10),
                    get avg10DaysRatio() {
                        // @ts-ignore
                        return +(this.volume / this.avg10Days).toFixed(2) ;
                    },
                    avg90Days: quoteUtils.calculateAverage(fullYearDailyHistory.candles, tradeDay, 90),
                    get avg90DaysRatio() {
                        // @ts-ignore
                        return +(this.volume / this.avg90Days).toFixed(2) ;
                    },
                };
            });
            const maxTenMoves = _.sortBy(quoteMoves, ["diff"]).reverse().slice(0, BiggestMoversQuota);

            let datesArray = "[";

            for (let j = 0; j < maxTenMoves.length; j++) {
                logger.debug(JSON.stringify(maxTenMoves[j]));
                datesArray += "\"" + maxTenMoves[j].time + "\", ";
            }
            datesArray = datesArray.replace(/,(?=[^,]*$)/, "]");

            const avg10avg = _.meanBy(quoteMoves.filter((item) => item.avg10DaysRatio > 1), "avg10DaysRatio").toFixed(2);
            const avg90avg = _.meanBy(quoteMoves.filter((item) => item.avg10DaysRatio > 1), "avg90DaysRatio").toFixed(2);
            logger.debug("----------------------------------------------------------------------------");
            logger.debug("avg10avg=" + avg10avg + " ,avg90avg=" + avg90avg  );
            logger.debug( datesArray );
            logger.debug("----------------------------------------------------------------------------");
        }
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes.push(quote);
            this.profitLossAccountPerQuote[quote] = 0;
        });
    }

    private calculateProfitLossPerTradeDay(historicalData: any, currentQuote: string, tradeDay: string) {

        const quote5MinuteHistory = historicalData.quote5MinuteHistory;
        const quoteMetadata = quoteUtils.composeMetadata(historicalData, tradeDay);
        const quoteStats = new QuoteStats(currentQuote, tradeDay);
        const profitLossAccount = quoteStats.initializeStockData(quote5MinuteHistory[tradeDay], quoteMetadata);

        return profitLossAccount;
    }
}
