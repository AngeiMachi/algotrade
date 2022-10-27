import * as _ from 'lodash';
import moment from 'moment-timezone';
import * as request from 'request-promise';

import * as environmentConfig from '../config/environment.Config.json';
import { logger } from '../config/winston.config';

import { parseMustache } from '../utils/general';
import * as convertUtils from '../utils/convert-utils';
import * as quoteUtils from '../utils/quote-utils';
import * as tdConfig from '../../config/tdaclientauth.json';
import Bottleneck from 'bottleneck';

const tdaclient = require('tda-api-client');

const quotesPulledFirstPremarket:{[key:string]:boolean} ={}

import { IQuoteHistoricalIntervals, ITDAmeritradePriceHistory, IQuoteIntervals, ITDAmeritradeIntervalData } from '../models/quote-data.model';

const limiter = new Bottleneck({
    reservoir: 110, // initial value
    reservoirRefreshAmount: 110,
    reservoirRefreshInterval: 61 * 1000,
    maxConcurrent: 110,
    minTime: 0,
});

export const getQuote5MinuteHistory = async (quote: string, specificTradeDates: string[] = []): Promise<IQuoteHistoricalIntervals> => {
    try {
        const options = {
            startDate: 1530792613000,
            endDate: moment(new Date()).unix() * 1000,
            quote: quote.toUpperCase(),
            api_key: environmentConfig.TDAmeritradeAPI.api_key,
        };
        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_5_minutes, options);

        const response = await limiter.schedule(() => request.get({ url: fullURL }));

        const parsedResponse = JSON.parse(response);
        let groupedIntervalsByDay = _.groupBy(parsedResponse.candles, groupByDateFunction);

        if (specificTradeDates.length > 0) {
            groupedIntervalsByDay = _.pick(groupedIntervalsByDay, specificTradeDates);
        }

        groupedIntervalsByDay = _.omitBy(groupedIntervalsByDay, (intervals) => intervals.length !== 78);

        const quote5MinuteHistory = convertUtils.convertTDAmeritradeMultipleDaysOf5MinuteIntervals(groupedIntervalsByDay);
        return quote5MinuteHistory;
    } catch (err) {
        logger.error('getQuote5MinuteHistory failed ' + err);
        throw err;
    }
};
export const getQuote5MinuteIntraday = async (quote: string, tradeDate: string, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        
        const endDate =moment.tz(tradeDate, 'America/New_York').add(9, 'hours').add(25, 'minutes').unix() * 1000;
        const startDate = quotesPulledFirstPremarket[quote]? endDate : moment.tz(quoteUtils.getPreviousTradingDate(tradeDate), 'America/New_York').add(9, 'hours').add(25, 'minutes').unix() * 1000;
      
        
        const priceHistoryConfig = {
            startDate: startDate,
            endDate: endDate,
            periodType: tdaclient.pricehistory.PERIOD_TYPE.DAY,
            frequencyType: tdaclient.pricehistory.FREQUENCY_TYPE.DAY.MINUTE,
            frequency: tdaclient.pricehistory.FREQUENCY.MINUTE.FIVE,
            symbol: quote.toUpperCase(),
            getExtendedHours: getExtendedHours.toString(),
        };

        const getPriceHistoryResult = (await limiter.schedule(() => tdaclient.pricehistory.getPriceHistory(priceHistoryConfig))) as any;

        if  (getPriceHistoryResult.length===1 && getPriceHistoryResult.candle[0].volume==0) {
            quotesPulledFirstPremarket[quote] =false;
        } else {
            quotesPulledFirstPremarket[quote] =true;
        }
            
        const quote5MinutIntraday = convertUtils.convertTDAmeritrade5MinuteIntervals(getPriceHistoryResult.candles as any);
        
        
        return quote5MinutIntraday;
    } catch (err) {
        logger.error('getQuote5MinuteIntraday failed ' + err);
        throw err;
    }
};
export const getQuote5MinuteMultipleDays = async (quote: string, tradeDate: string,daysBack:number=0, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        const startDate = moment.tz(tradeDate, 'America/New_York').subtract(daysBack,'days').add(9, 'hours').add(25, 'minutes').unix() * 1000;
        const endDate = moment.tz(tradeDate, 'America/New_York').add(9, 'hours').add(25, 'minutes').unix() * 1000;
                
        const priceHistoryConfig = {
            startDate: startDate,
            endDate: endDate,
            periodType: tdaclient.pricehistory.PERIOD_TYPE.DAY,
            frequencyType: tdaclient.pricehistory.FREQUENCY_TYPE.DAY.MINUTE,
            frequency: tdaclient.pricehistory.FREQUENCY.MINUTE.FIVE,
            symbol: quote.toUpperCase(),
            getExtendedHours: getExtendedHours.toString(),
        };

        const getPriceHistoryResult = (await limiter.schedule(() => tdaclient.pricehistory.getPriceHistory(priceHistoryConfig))) as any;

        const quote5MinutIntraday = convertUtils.convertTDAmeritrade5MinuteIntervals(getPriceHistoryResult.candles as any);
        
        return quote5MinutIntraday;
    } catch (err) {
        logger.error('getQuote5MinuteIntraday failed ' + err);
        throw err;
    }
};
export const getQuote5MinuteIntraday_old = async (quote: string, tradeDate: string): Promise<IQuoteIntervals> => {
    try {
        const startDate = moment.tz(tradeDate, 'America/New_York').add(9, 'hours').add(25, 'minutes').unix() * 1000;
        const endDate =
            moment
                .tz(tradeDate, 'America/New_York')
                .add(9 + 8, 'hours')
                .unix() * 1000;
        const options = {
            startDate,
            endDate,
            quote: quote.toUpperCase(),
            api_key: environmentConfig.TDAmeritradeAPI.api_key,
        };
        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_5_minutes, options);

        const response = await limiter.schedule(() => request.get({ url: fullURL }));

        const parsedResponse = JSON.parse(response);

        const preTradingHoursRemoved = parsedResponse.candles.filter((intervals: ITDAmeritradeIntervalData) => intervals.datetime >= startDate);
        const quote5MinutIntraday = convertUtils.convertTDAmeritrade5MinuteIntervals(preTradingHoursRemoved as any);
        return quote5MinutIntraday;
    } catch (err) {
        logger.error('getQuote5MinuteIntraday failed ' + err);
        throw err;
    }
};
export const getQuoteFullYearDailyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
        };

        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_daily_full_year, options);

        const response = await limiter.schedule(() => request.get({ url: fullURL }));

        const dailyIntervals = JSON.parse(response) as ITDAmeritradePriceHistory;

        return dailyIntervals;
    } catch (err) {
        logger.error('getQuoteFullYearDailyHistory failed ' + err);
        throw err;
    }
};

export const getQuoteFullYearWeeklyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
        };

        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_weekly_full_year, options);

        const response = await limiter.schedule(() => request.get({ url: fullURL }));

        const weeklyIntervals = JSON.parse(response) as ITDAmeritradePriceHistory;

        return weeklyIntervals;
    } catch (err) {
        logger.error('getQuoteFullYearDailyHistory failed ' + err);
        throw err;
    }
};
export const getQuoteHourlyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
        };

        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_hourly, options);

        const response = await limiter.schedule(() => request.get({ url: fullURL }));

        const hourlyIntervals = JSON.parse(response) as ITDAmeritradePriceHistory;

        return hourlyIntervals;
    } catch (err) {
        logger.error('getQuoteHourlyHistory failed ' + err);
        throw err;
    }
};

export const getMarketHours = async (tradeDate: string): Promise<any> => {
    const configGetMarketHrs = {
        market: 'EQUITY',
        date: tradeDate,
        apikey: tdConfig.client_id,
    };
    
    const hrs =  (await limiter.schedule(() => tdaclient.markethours.getSingleMarketHours(configGetMarketHrs)));

    return hrs;
};

function groupByDateFunction(interval: any) {
    return moment(interval.datetime).format('YYYY-MM-DD');
}

limiter.on('debug', function (message, data) {
    // Useful to figure out what the limiter is doing in real time
    // and to help debug your application
    //@ts-ignore
    //console.log(limiter.jobs('RUNNING'));
});

limiter.on('failed', function (error, jobInfo) {
    logger.error('Fail TD Ameritrade API call Error :' + error);
    
    if (error.includes('markethours')) {
        throw "Can't get market hours from TD Ameritrade API";
    }
    if (jobInfo.retryCount <= 9) { // Here we only retry once
        logger.info(`Retrying API call in 30 second(try #${jobInfo.retryCount})...`);
        return 30000;
    }
    logger.info(`Aborting job after 10 retries`);
});
