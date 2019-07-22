import moment from "moment-timezone";
import * as request from "request-promise";
import { logger } from "./config/winston.config.js";
import * as environmentConfig from "./config/environment.Config.json";
import { getCurrentTradingDay, convertYahooIntervals } from "./utils/utils.js";
import * as TDAmeritradeAPI from "./td-ameritrade-api";
import { INTERVAL_PROPERTY_NAME, METADATA_PROPERTY_NAME, LAST_REFRESHED_PROPERTY_NAME } from "./config/globals.config";
import { IAlphaVantageIntervals, IQouteMetadata, IQouteFullIntervalData, IQuotesHistoricalsData } from "./models/stock-interval-data.model";
import { parseMustache } from "./utils/general.js";

export class ProxyService {

    private alphaAPI: any;

    private mockDataResponse: any = {};
    private mockDataResponseValues: any[] = [];
    private mockDataResponseKeys: any[] = [];
    private currentInterval: number;
    private mockDataDate: string = "";
    private isMockLoaded: boolean = false;

    constructor(key: string) {
        this.alphaAPI = require("alphavantage")({ key });
        this.currentInterval = environmentConfig.Mock.StartLiveSimulationAtInterval;

        this.mockDataResponse[INTERVAL_PROPERTY_NAME] = {};
        this.mockDataResponse[METADATA_PROPERTY_NAME] = {};

        this.mockDataDate = getCurrentTradingDay();
    }

    // main method to get alphaVantage Intraday data
    public async getIntraday(quote: string): Promise<any> {
        if (environmentConfig.Mock.IsMock) {
            if (!this.isMockLoaded) {
                await this.prepareMockData(quote);
            }
            return this.serveMockData();
        } else {
            return this.alphaAPI.data.intraday(quote, "compact", "json", "5min").then((data: any) => {
                return data;
            });
        }
    }

    public async getAlphaVantageHistoricalData(quote: string): Promise<any> {
        try {
            const quoteHistoricalDataResponse: any[] = [];

            const data = await this.alphaAPI.data.intraday(quote, "full", "json", "5min");
            let tradingDayDate: string = "";
            let lastRefreshedTime: string = "";
            let tradingDayIntervals: IAlphaVantageIntervals = {};
            const quoteMetadata = data[METADATA_PROPERTY_NAME];

            Object.keys(data[INTERVAL_PROPERTY_NAME]).reverse().forEach((key, index) => {
                if (key.substring(0, 10) !== tradingDayDate) {
                    if (tradingDayDate) {
                        quoteMetadata[LAST_REFRESHED_PROPERTY_NAME] = lastRefreshedTime;
                        quoteHistoricalDataResponse.push({
                            "Meta Data": { ...quoteMetadata },
                            "Time Series (5min)": { ...tradingDayIntervals }
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
                "Time Series (5min)": { ...tradingDayIntervals }
            });

            return Promise.resolve(quoteHistoricalDataResponse);

        } catch (err) {
            Promise.reject(err);
        }
    }

    public async getYahooFinanceMetadata(quote: string, tradeDay?: moment.Moment): Promise<any> {

        const quoteDailyHistorical = await this.getYahooFinanceDailyHistorical(quote, 5, tradeDay);

        const fullURL = parseMustache(environmentConfig.Yahoo.get_metadata, { quote });

        const yahooQuoteRawMetadata = await request.get({ url: fullURL });
        const yahooQuoteMetadata = JSON.parse(yahooQuoteRawMetadata).quoteSummary.result[0];

        let quoteMetadata: IQouteMetadata = {
            averageDailyVolume10Day: yahooQuoteMetadata.price.averageDailyVolume10Day,
            averageDailyVolume3Month: yahooQuoteMetadata.price.averageDailyVolume3Month,
            regularMarketPreviousClose: yahooQuoteMetadata.price.regularMarketPreviousClose,
            fiftyTwoWeekLow: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekLow,
            fiftyTwoWeekHigh: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekHigh,

            dailyHistoricalData: quoteDailyHistorical
        }
        return quoteMetadata;
    }

    public async getYahooFinanceDailyHistorical(quote: string, daysBack: number, tradeDay?: moment.Moment): Promise<IQouteFullIntervalData[]> {

        const finalCurrentDay = tradeDay ? tradeDay : moment().subtract(1, "days")

        const options = {
            quote: quote,
            endDay: finalCurrentDay.unix(),
            startDay: finalCurrentDay.subtract(daysBack + 1, "days").unix()

        }

        const fullURL = parseMustache(environmentConfig.Yahoo.get_historical_daily, options);

        const yahooQuoteRawHistorical = await request.get({ url: fullURL });
        const yahooQuoteHistorical = JSON.parse(yahooQuoteRawHistorical).chart.result[0];

        return convertYahooIntervals(yahooQuoteHistorical.timestamp, yahooQuoteHistorical.indicators.quote[0]);
    }

    public async getHistoricalData(quote: string): Promise<IQuotesHistoricalsData> {

        try {
           
            const quote5MinuteHistory = await  TDAmeritradeAPI.getQuote5MinuteHistory(quote);
            const quoteFullYearDailyHistory = await TDAmeritradeAPI.getQuoteFullYearDailyHistory(quote);
            const SMA = await this.alphaAPI.technical.sma(quote, `daily`, 5, `close`);
            await request.get({url:"https://reqres.in/api/users?delay=6"});
    
            return  {
                SMA,
                quote5MinuteHistory,
                quoteFullYearDailyHistory
            }
        } catch (err) {
                throw err;
        }
        
    }

    private async prepareMockData(quote: string): Promise<any> {
        try {
            let quoteMockResponse: any;
            const mockIntervals: IAlphaVantageIntervals = {};

            await this.alphaAPI.data.intraday(quote, "full", "json", "5min").then((data: any) => {
                quoteMockResponse = data;
            });

            Object.keys(quoteMockResponse[INTERVAL_PROPERTY_NAME]).forEach((key) => {
                if (key.includes(this.mockDataDate)) {
                    mockIntervals[key] = quoteMockResponse[INTERVAL_PROPERTY_NAME][key];
                }
            });

            this.mockDataResponseValues = Object.values(mockIntervals).reverse();
            this.mockDataResponseKeys = Object.keys(mockIntervals).reverse();

            for (let i = 0; i < this.currentInterval; i++) {
                this.mockDataResponse[INTERVAL_PROPERTY_NAME][this.mockDataResponseKeys[i]] = this.mockDataResponseValues[i];
            }

            this.mockDataResponse[METADATA_PROPERTY_NAME] = quoteMockResponse[METADATA_PROPERTY_NAME];

            this.isMockLoaded = true;

            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    private serveMockData(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                if (this.mockDataResponseKeys[this.currentInterval]) {
                    this.mockDataResponse[INTERVAL_PROPERTY_NAME][this.mockDataResponseKeys[this.currentInterval]] =
                        this.mockDataResponseValues[this.currentInterval];
                    this.mockDataResponse[METADATA_PROPERTY_NAME][LAST_REFRESHED_PROPERTY_NAME] =
                        this.mockDataResponseKeys[this.currentInterval];
                    this.currentInterval++;
                }
                resolve(this.mockDataResponse);
            } catch (err) {
                return reject(err);
            }
        });
    }

}
