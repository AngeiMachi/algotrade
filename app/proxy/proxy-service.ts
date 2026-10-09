import moment from 'moment-timezone';
import * as request from 'request-promise';

import { logger } from '../config/winston.config';
import * as environmentConfig from '../config/environment.Config.json';
import * as globalConfig from '../config/globals.config';

import * as convertUtils from '../utils/convert-utils';
import * as quoteUtils from '../utils/quote-utils';
import { parseMustache } from '../utils/general';

import * as AlpacaAPI from './alpaca-api';
import * as AlphaVantage from './alpha-vantage-api';
import * as mockService from './mock-service';
import * as QuotesCache from '../engine/quotes-cache';
import * as stateService from '../engine/state';

import { IQuoteMetadata, IQuoteFullIntervalData, IQuotesHistoricalData, ITDAmeritradePriceHistory, IQuoteIntervals, IMarketHours } from '../models/quote-data.model';

import { IAlphaVantageIntervals, INTERVAL_PROPERTY_NAME, METADATA_PROPERTY_NAME, LAST_REFRESHED_PROPERTY_NAME } from '../models/alpha-vantage.model';
import { TimeFrame } from '../models/enums';
import { resolve } from 'app-root-path';


let  _marketHours = {} as IMarketHours;

export const getMarketHours=() => {
        return _marketHours;
}

const initialize = async ()=> {
        _marketHours = await getMarketHoursFromAPI();
        stateService.setMarketHours(_marketHours);
}

    // main method to get alphaVantage Intraday data
export const  getAlphaVantageIntraday= async (quote: string): Promise<any> =>{
    if (globalConfig.Mock.IsMock) {
        if (!mockService.isMockLoaded(quote)) {
                await mockService.prepareMockDataAlphaVantage(quote);
        }
        return mockService.serveMockDataAlphaVantage(quote);
    } else {
        return AlphaVantage.getIntraday5Minute(quote, 'compact');
    }
}

// main method to get 5 minute Intraday data
export const  getIntraday5Minute = async (quote: string, getExtendedHours: boolean = true): Promise<IQuoteIntervals> =>{
    if (globalConfig.Mock.IsMock) {
        if (!mockService.isMockLoaded(quote)) {
                await mockService.prepareMockData5Minute(quote, _marketHours);
        }
        return mockService.serveMockData5Minute(quote);
    } else {
        const quoteIntervals = await AlpacaAPI.getQuote5MinuteIntraday(quote, quoteUtils.getCurrentTradingDate(), getExtendedHours);
        //return quoteIntervals;
        return quoteUtils.removoLastIntervalData(quoteIntervals);
    }
}

// The time the data reflects: the simulated clock in mock mode, the wall clock live.
export const getDataClock = (): moment.Moment => (globalConfig.Mock.IsMock && mockService.getMockNow()) || moment().tz('America/New_York');

// Between the decision window start and the bell, the race also counts the 5-minute candle still forming.
export const isFormingCandleWindow = (): boolean => {
    const now = getDataClock().format('YYYY-MM-DD HH:mm:ss');
    const tradeDate = quoteUtils.getCurrentTradingDate();
    const bellKey = _marketHours?.sessionHours?.regularMarket?.start || `${tradeDate} 09:30:00`;
    return now >= `${tradeDate} ${globalConfig.PremarketRace.decisionWindowStart}:00` && now < bellKey;
};

export const getIntraday5MinuteWithFormingCandle = async (quote: string): Promise<IQuoteIntervals> =>
    globalConfig.Mock.IsMock
        ? mockService.serveMockIntervalsWithFormingCandle(quote)
        : AlpacaAPI.getQuote5MinuteIntraday(quote, quoteUtils.getCurrentTradingDate(), true);

export const getMarketHoursFromAPI= async (): Promise<IMarketHours> =>{
    let marketHours={} as IMarketHours;
    try {
        const tradeDate = quoteUtils.getCurrentTradingDate();
        const mrkHrs = await AlpacaAPI.getMarketHours(tradeDate);
        marketHours = convertUtils.convertAlpacaMarketHours(mrkHrs, tradeDate);
        
    } catch (err) {
        logger.error('getMarketHoursFromAPI failed, using default market hours ' + err);
        marketHours = quoteUtils.generateDefaultMarketHours();
    }
    finally {
        quoteUtils.setMarketHours(marketHours);
    }
    return  marketHours;
}

export const getAlphaVantageHistoricalData= async(quote: string): Promise<any> => {
    try {
        let tradingDayDate: string = '';
        let lastRefreshedTime: string = '';
        let tradingDayIntervals: IAlphaVantageIntervals = {};
        const quoteHistoricalDataResponse: any[] = [];

        const data = await AlphaVantage.getIntraday5Minute(quote, 'full');

        const quoteMetadata = data[METADATA_PROPERTY_NAME];

        Object.keys(data[INTERVAL_PROPERTY_NAME])
            .reverse()
            .forEach((key, index) => {
                if (key.substring(0, 10) !== tradingDayDate) {
                    if (tradingDayDate) {
                        quoteMetadata[LAST_REFRESHED_PROPERTY_NAME] = lastRefreshedTime;
                        quoteHistoricalDataResponse.push({
                            'Meta Data': { ...quoteMetadata },
                            'Time Series (5min)': { ...tradingDayIntervals },
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
            'Meta Data': { ...quoteMetadata },
            'Time Series (5min)': { ...tradingDayIntervals },
        });

        return Promise.resolve(quoteHistoricalDataResponse);
    } catch (err) {
        Promise.reject(err);
    }
}

export const getHistoricalData= async (quote: string, specificTradeDates: string[] = []): Promise<IQuotesHistoricalData> => {
    try {
        const quote5MinuteHistory = await AlpacaAPI.getQuote5MinuteHistory(quote, specificTradeDates);
        const quoteFullYearDailyHistory = await AlpacaAPI.getQuoteFullYearDailyHistory(quote);
        const quoteFullYearWeeklyHistory = await AlpacaAPI.getQuoteFullYearWeeklyHistory(quote);
        const quoteHourlyHistory = await AlpacaAPI.getQuoteHourlyHistory(quote);

        return {
            quote5MinuteHistory,
            quoteFullYearDailyHistory,
            quoteFullYearWeeklyHistory,
            quoteHourlyHistory,
        };
    } catch (err) {
        throw err;
    }
}

export const getMetaDataPerDay = async (quote: string, tradeDay: string): Promise<IQuoteMetadata | null> =>{
        try {
            
            let quoteFullYearDailyHistory = QuotesCache.getQuoteFromCache(quote,TimeFrame.Daily);
            if (!quoteFullYearDailyHistory) {
                quoteFullYearDailyHistory = await AlpacaAPI.getQuoteFullYearDailyHistory(quote);
            }
            let quoteFullYearWeeklyHistory = QuotesCache.getQuoteFromCache(quote,TimeFrame.Weekly);
            if (!quoteFullYearWeeklyHistory) {
                quoteFullYearWeeklyHistory = await AlpacaAPI.getQuoteFullYearWeeklyHistory(quote);
            }
            let quoteHourlyHistory = QuotesCache.getQuoteFromCache(quote,TimeFrame.Hourly);
            if (!quoteHourlyHistory) {
                quoteHourlyHistory = await AlpacaAPI.getQuoteHourlyHistory(quote);
            }
            
            const quotesHistoricalData: IQuotesHistoricalData = {
                quoteFullYearDailyHistory,
                quoteFullYearWeeklyHistory,
                quoteHourlyHistory
            };

            QuotesCache.deleteCache(quote);

            if (quotesHistoricalData.quoteFullYearDailyHistory.candles.length==0 || 
                quotesHistoricalData.quoteFullYearWeeklyHistory.candles.length==0 || 
                quotesHistoricalData.quoteHourlyHistory.candles.length==0) {
                    return null
                }
                
            const metadata: IQuoteMetadata = quoteUtils.composeMetadata(tradeDay, quotesHistoricalData);
            return metadata;
        } catch (err) {
            throw err;
        }
    }

export const  getDailyHistory=async (quote: string, daysBack: number): 
    Promise<{partialHistoryDailyIntervals: IQuoteFullIntervalData[], fullYearDailyHistory: ITDAmeritradePriceHistory }> => {

    const fullYearDailyHistory = await AlpacaAPI.getQuoteFullYearDailyHistory(quote);
    const tradeDay = fullYearDailyHistory.candles[fullYearDailyHistory.candles.length - 1].datetime;
    const partialDailyHistory = quoteUtils.getPartialHistory(fullYearDailyHistory.candles, tradeDay, daysBack);
    const partialHistoryDailyIntervals = convertUtils.convertTDAmeritradeDailyIntervals(partialDailyHistory);

    return {
        partialHistoryDailyIntervals,
        fullYearDailyHistory,
    };
}

export const getYahooFinanceMetadata= async (quote: string, tradeDay?: moment.Moment): Promise<any> =>{
    const quoteDailyHistorical = await getYahooFinanceDailyHistorical(quote, 5, tradeDay);

    // @ts-ignore
    const fullURL = parseMustache(environmentConfig.Yahoo.get_metadata, { quote });

    const yahooQuoteRawMetadata = await request.get({ url: fullURL });
    const yahooQuoteMetadata = JSON.parse(yahooQuoteRawMetadata).quoteSummary.result[0];

    // @ts-ignore
    const quoteMetadata: IQuoteMetadata = {
        averageDailyVolume10Day: yahooQuoteMetadata.price.averageDailyVolume10Day,
        averageDailyVolume3Month: yahooQuoteMetadata.price.averageDailyVolume3Month,
        //previousClose: yahooQuoteMetadata.price.regularMarketPreviousClose,
        fiftyTwoWeekLow: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: yahooQuoteMetadata.summaryDetail.fiftyTwoWeekHigh,

        dailyHistoricalData: quoteDailyHistorical,
    };
    return quoteMetadata;
}

export const getYahooFinanceDailyHistorical= async (quote: string, daysBack: number, tradeDay?: moment.Moment): Promise<IQuoteFullIntervalData[]> => {
    const finalCurrentDay = tradeDay ? tradeDay : moment().subtract(1, 'days');
    const options = {
        quote,
        endDay: finalCurrentDay.unix(),
        startDay: finalCurrentDay.subtract(daysBack + 1, 'days').unix(),
    };

    const fullURL = parseMustache(environmentConfig.Yahoo.get_historical_daily, options);

    const yahooQuoteRawHistorical = await request.get({ url: fullURL });
    const yahooQuoteHistorical = JSON.parse(yahooQuoteRawHistorical).chart.result[0];

    return convertUtils.convertYahooIntervals(yahooQuoteHistorical.timestamp, yahooQuoteHistorical.indicators.quote[0]);
}

initialize();