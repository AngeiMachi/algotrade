import moment from "moment-timezone";
import * as request from "request-promise";

import { logger } from "../config/winston.config.js";
import * as environmentConfig from "../config/environment.Config.json";
import * as globalConfig from "../config/globals.config"

import * as convertUtils from "../utils/convert-utils";
import * as quoteUtils from "../utils/quote-utils";
import { parseMustache } from "../utils/general";

import * as TDAmeritradeAPI from "./td-ameritrade-api";
import * as AlphaVantage from "./alpha-vantage-api";
import * as mockService from "./mock-service";

import {
    IQuoteMetadata,
    IQuoteFullIntervalData,
    IQuotesHistoricalData,
    ITDAmeritradePriceHistory,
    IQuoteIntervals
} from "../models/stock-interval-data.model";

import {
    IAlphaVantageIntervals,
    INTERVAL_PROPERTY_NAME,
    METADATA_PROPERTY_NAME,
    LAST_REFRESHED_PROPERTY_NAME
} from "../models/alpha-vantage.model";

export class ProxyService {

    constructor() {
    }

    // main method to get alphaVantage Intraday data
    public async getAlphaVantageIntraday(quote: string): Promise<any> {
        if (globalConfig.Mock.IsMock) {
            if (!mockService.isMockLoaded(quote)) {
                await mockService.prepareMockDataAlphaVantage(quote);
            }
            return mockService.serveMockDataAlphaVantage(quote);
        } else {
            return AlphaVantage.getIntraday5Minute(quote, "compact");
        }
    }
    // main method to get TDAmeritrade Intraday data
    public async getTDAmeritradeIntraday(quote: string): Promise<IQuoteIntervals> {
        if (globalConfig.Mock.IsMock) {
            if (!mockService.isMockLoaded(quote)) {
                await mockService.prepareMockDataTDAmeritrade(quote);
            }
            return mockService.serveMockDataTDAmeritrade(quote);
        } else {
            return TDAmeritradeAPI.getQuote5MinuteIntraday(quote,quoteUtils.getCurrentTradingDate());
        }
    }

    public async getAlphaVantageHistoricalData(quote: string): Promise<any> {
        try {
            let tradingDayDate: string = "";
            let lastRefreshedTime: string = "";
            let tradingDayIntervals: IAlphaVantageIntervals = {};
            const quoteHistoricalDataResponse: any[] = [];

            const data = await AlphaVantage.getIntraday5Minute(quote, "full");

            const quoteMetadata = data[METADATA_PROPERTY_NAME];

            Object.keys(data[INTERVAL_PROPERTY_NAME]).reverse().forEach((key, index) => {
                if (key.substring(0, 10) !== tradingDayDate) {
                    if (tradingDayDate) {
                        quoteMetadata[LAST_REFRESHED_PROPERTY_NAME] = lastRefreshedTime;
                        quoteHistoricalDataResponse.push({
                            "Meta Data": { ...quoteMetadata },
                            "Time Series (5min)": { ...tradingDayIntervals },
                        });
                        tradingDayIntervals = {};
                    }
                    tradingDayDate = key.substring(0, 10);
                }
                tradingDayIntervals[key] = data[INTERVAL_PROPERTY_NAME][key];
                lastRefreshedTime = key;
            });
            quoteMetadata[LAST_REFRESHED_PROPERTY_NAME] = lastRefreshedTime;
            quoteHistoricalDataResponse.push({
                "Meta Data": { ...quoteMetadata },
                "Time Series (5min)": { ...tradingDayIntervals },
            });

            return Promise.resolve(quoteHistoricalDataResponse);

        } catch (err) {
            Promise.reject(err);
        }
    }

    public async getHistoricalData(quote: string, specificTradeDates: string[] = []): Promise<IQuotesHistoricalData> {
        try {
            const quote5MinuteHistory = await TDAmeritradeAPI.getQuote5MinuteHistory(quote, specificTradeDates);
            const quoteFullYearDailyHistory = await TDAmeritradeAPI.getQuoteFullYearDailyHistory(quote);
        

            return {
             
                quote5MinuteHistory,
                quoteFullYearDailyHistory,
            };
        } catch (err) {
            throw err;
        }
    }

    public async getMetaDataPerDay(quote: string, tradeDay: string,quoteIntervals:IQuoteIntervals): Promise<IQuoteMetadata> {
        try {

            let firstInterval = quoteIntervals[Object.keys(quoteIntervals)[0]];
            const quoteFullYearDailyHistory = await TDAmeritradeAPI.getQuoteFullYearDailyHistory(quote);
   

            const quotesHistoricalData: IQuotesHistoricalData = {
                quoteFullYearDailyHistory,
              
            }

            const metadata: IQuoteMetadata = quoteUtils.composeMetadata( tradeDay, quotesHistoricalData,firstInterval);
            return metadata;
        } catch (err) {
            throw err;
        }
    }

    public async getTDAmeritradeDailyHistory(quote: string, daysBack: number):
        Promise<{
            partialHistoryDailyIntervals: IQuoteFullIntervalData[],
            fullYearDailyHistory: ITDAmeritradePriceHistory,
        }> {

        const fullYearDailyHistory = await TDAmeritradeAPI.getQuoteFullYearDailyHistory(quote);
        const tradeDay = fullYearDailyHistory.candles[fullYearDailyHistory.candles.length - 1].datetime;
        const partialDailyHistory = quoteUtils.getPartialHistory(fullYearDailyHistory.candles, tradeDay, daysBack);
        const partialHistoryDailyIntervals = convertUtils.convertTDAmeritradeDailyIntervals(partialDailyHistory);

        return {
            partialHistoryDailyIntervals,
            fullYearDailyHistory,
        };
    }

    public async getYahooFinanceMetadata(quote: string, tradeDay?: moment.Moment): Promise<any> {

        const quoteDailyHistorical = await this.getYahooFinanceDailyHistorical(quote, 5, tradeDay);

        // @ts-ignore
        const fullURL = parseMustache(environmentConfig.Yahoo.get_metadata, { quote });

        const yahooQuoteRawMetadata = await request.get({ url: fullURL });
        const yahooQuoteMetadata = JSON.parse(yahooQuoteRawMetadata).quoteSummary.result[0];

        // @ts-ignore
        const quoteMetadata: IQuoteMetadata = {
            averageDailyVolume10Day: yahooQuoteMetadata.price.averageDailyVolume10Day,
            averageDailyVolume3Month: yahooQuoteMetadata.price.averageDailyVolume3Month,
            previousClose: yahooQuoteMetadata.price.regularMarketPreviousClose,
            fiftyTwoWeekLow: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekLow,
            fiftyTwoWeekHigh: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekHigh,

            dailyHistoricalData: quoteDailyHistorical,
        };
        return quoteMetadata;
    }

    public async getYahooFinanceDailyHistorical(quote: string, daysBack: number, tradeDay?: moment.Moment):
        Promise<IQuoteFullIntervalData[]> {
        const finalCurrentDay = tradeDay ? tradeDay : moment().subtract(1, "days");
        const options = {
            quote,
            endDay: finalCurrentDay.unix(),
            startDay: finalCurrentDay.subtract(daysBack + 1, "days").unix(),
        };

        const fullURL = parseMustache(environmentConfig.Yahoo.get_historical_daily, options);

        const yahooQuoteRawHistorical = await request.get({ url: fullURL });
        const yahooQuoteHistorical = JSON.parse(yahooQuoteRawHistorical).chart.result[0];

        return convertUtils.convertYahooIntervals(yahooQuoteHistorical.timestamp, yahooQuoteHistorical.indicators.quote[0]);
    }

}
