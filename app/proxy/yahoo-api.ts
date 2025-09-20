import * as _ from 'lodash';
import moment from 'moment-timezone';
const yahooFinance = require('yahoo-finance2');
import Bottleneck from 'bottleneck';

import { logger } from '../config/winston.config';
import * as convertUtils from '../utils/convert-utils';
import * as quoteUtils from '../utils/quote-utils';

import { IQuoteHistoricalIntervals, ITDAmeritradePriceHistory, IQuoteIntervals, ITDAmeritradeIntervalData, IMarketHours } from '../models/quote-data.model';

// Rate limiting to prevent API throttling
const limiter = new Bottleneck({
    reservoir: 2000, // Yahoo Finance allows more requests than TD Ameritrade
    reservoirRefreshAmount: 2000,
    reservoirRefreshInterval: 60 * 60 * 1000, // 1 hour
    maxConcurrent: 5,
    minTime: 50, // 50ms between requests
});

const quotesPulledFirstPremarket: {[key: string]: boolean} = {};

/**
 * Create synthetic 5-minute intraday intervals from daily OHLCV data
 * This maintains compatibility with the existing application architecture
 */
function createSyntheticIntradayData(dailyData: any, tradeDate: string): IQuoteIntervals {
    const intervals: IQuoteIntervals = {};
    
    // Standard US trading day: 9:30 AM to 4:00 PM = 6.5 hours = 78 five-minute intervals
    const totalIntervals = 78;
    const startTime = moment.tz(tradeDate, 'America/New_York').hour(9).minute(30).second(0);
    
    const { open, high, low, close, volume } = dailyData;
    const totalVolume = volume || 0;
    
    // Create realistic price progression from open to close
    for (let i = 0; i < totalIntervals; i++) {
        const intervalTime = startTime.clone().add(i * 5, 'minutes');
        const timeKey = intervalTime.format('YYYY-MM-DD HH:mm:ss');
        
        // Progress through the day (0 to 1)
        const progress = i / (totalIntervals - 1);
        
        // Create realistic OHLC for this interval
        const basePrice = open + (close - open) * progress;
        const volatility = (high - low) * 0.1; // 10% of daily range per interval
        
        const intervalOpen = i === 0 ? open : intervals[Object.keys(intervals)[i - 1]]?.close || basePrice;
        const intervalClose = i === totalIntervals - 1 ? close : basePrice + (Math.random() - 0.5) * volatility;
        
        // Ensure high and low respect daily bounds
        const intervalHigh = Math.min(high, Math.max(intervalOpen, intervalClose) + volatility * Math.random());
        const intervalLow = Math.max(low, Math.min(intervalOpen, intervalClose) - volatility * Math.random());
        
        // Distribute volume throughout the day (higher at open/close, lower at midday)
        const volumePattern = Math.sin(Math.PI * progress) + 0.5; // Bell curve-ish
        const intervalVolume = Math.round(totalVolume / totalIntervals * volumePattern);
        
        intervals[timeKey] = {
            open: Number(intervalOpen.toFixed(2)),
            high: Number(intervalHigh.toFixed(2)),
            low: Number(intervalLow.toFixed(2)),
            close: Number(intervalClose.toFixed(2)),
            volume: intervalVolume,
            timeIsrael: new Date(intervalTime.clone().tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')),
            timeNewYork: new Date(intervalTime.format('YYYY-MM-DD HH:mm:ss'))
        };
    }
    
    return intervals;
}

/**
 * Convert Yahoo Finance historical data to TD Ameritrade compatible format
 */
function convertYahooToTDFormat(yahooData: any[]): ITDAmeritradeIntervalData[] {
    return yahooData.map(item => ({
        open: item.open || 0,
        high: item.high || 0,
        low: item.low || 0,
        close: item.close || 0,
        volume: item.volume || 0,
        datetime: item.date ? moment(item.date).valueOf() : 0
    }));
}

/**
 * Convert Yahoo Finance historical data to ITDAmeritradePriceHistory format
 */
function convertYahooToTDPriceHistory(yahooData: any[], symbol: string): ITDAmeritradePriceHistory {
    return {
        candles: convertYahooToTDFormat(yahooData),
        symbol: symbol.toUpperCase(),
        empty: !yahooData || yahooData.length === 0
    };
}

export const getQuote5MinuteHistory = async (quote: string, specificTradeDates: string[] = []): Promise<IQuoteHistoricalIntervals> => {
    try {
        const endDate = moment().toDate();
        const startDate = moment().subtract(30, 'days').toDate(); // Yahoo supports ~60 days, using 30 for safety
        
        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '5m',
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return {};
        }

        // Convert chart response to our format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));

        // Group by date like TD Ameritrade does
        let groupedIntervalsByDay = _.groupBy(chartData, (item: any) => 
            moment(item.date).format('YYYY-MM-DD')
        );

        if (specificTradeDates.length > 0) {
            groupedIntervalsByDay = _.pick(groupedIntervalsByDay, specificTradeDates);
        }

        // Convert to the expected format
        const quote5MinuteHistory: IQuoteHistoricalIntervals = {};
        Object.keys(groupedIntervalsByDay).forEach(date => {
            const intervals = groupedIntervalsByDay[date];
            const convertedIntervals: IQuoteIntervals = {};
            
            intervals.forEach((interval: any) => {
                const key = moment(interval.date).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
                convertedIntervals[key] = {
                    open: interval.open || 0,
                    high: interval.high || 0,
                    low: interval.low || 0,
                    close: interval.close || 0,
                    volume: interval.volume || 0,
                    timeIsrael: new Date(moment(interval.date).tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')),
                    timeNewYork: new Date(moment(interval.date).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'))
                };
            });
            
            quote5MinuteHistory[date] = convertedIntervals;
        });

        return quote5MinuteHistory;
    } catch (err) {
        logger.error('getQuote5MinuteHistory (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getQuote5MinuteIntraday = async (quote: string, tradeDate: string, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        // Get recent trading days to ensure we have 5-minute data
        // Yahoo Finance provides 5-minute data for last ~60 days
        const endDate = moment().toDate();
        const startDate = moment().subtract(5, 'days').toDate(); // Get last 5 days to ensure we have trading data

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '5m',
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return {};
        }

        // Convert chart response to TD Ameritrade compatible format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));

        // Filter for the specific trade date if provided, otherwise use most recent data
        let filteredData = chartData;
        if (tradeDate !== quoteUtils.getCurrentTradingDate()) {
            const targetDate = moment.tz(tradeDate, 'America/New_York').format('YYYY-MM-DD');
            filteredData = chartData.filter(item => 
                moment(item.date).tz('America/New_York').format('YYYY-MM-DD') === targetDate
            );
        }

        // Convert to expected intervals format
        const intervals: IQuoteIntervals = {};
        filteredData.forEach((item: any) => {
            const key = moment(item.date).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
            intervals[key] = {
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume,
                timeIsrael: new Date(moment(item.date).tz('Asia/Jerusalem').format('YYYY-MM-DD HH:mm:ss')),
                timeNewYork: new Date(moment(item.date).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'))
            };
        });

        quotesPulledFirstPremarket[quote] = true;
        return intervals;
    } catch (err) {
        logger.error('getQuote5MinuteIntraday (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getQuote5MinuteMultipleDays = async (quote: string, tradeDate: string, daysBack: number = 0, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        // Limit to Yahoo's 60-day intraday window
        const maxDaysBack = Math.min(daysBack, 59);
        const startDate = moment.tz(tradeDate, 'America/New_York').subtract(maxDaysBack, 'days').toDate();
        const endDate = moment.tz(tradeDate, 'America/New_York').add(1, 'day').toDate();

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '5m',
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return {};
        }

        // Convert chart response to TD Ameritrade compatible format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));

        return convertUtils.convertYahooFinanceIntervals(chartData);
    } catch (err) {
        logger.error('getQuote5MinuteMultipleDays (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getQuoteFullYearDailyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const endDate = moment().toDate();
        const startDate = moment().subtract(1, 'year').toDate();

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d',
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return { candles: [], symbol: quote.toUpperCase(), empty: true };
        }

        // Convert chart response to historical format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));
        
        return convertYahooToTDPriceHistory(convertUtils.convertYahooToTDAmeritradeFormat(chartData), quote);
    } catch (err) {
        logger.error('getQuoteFullYearDailyHistory (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getQuoteFullYearWeeklyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const endDate = moment().toDate();
        const startDate = moment().subtract(1, 'year').toDate();

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1wk' as const,
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return { candles: [], symbol: quote.toUpperCase(), empty: true };
        }

        // Convert chart response to historical format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));
        
        return convertYahooToTDPriceHistory(convertUtils.convertYahooToTDAmeritradeFormat(chartData), quote);
    } catch (err) {
        logger.error('getQuoteFullYearWeeklyHistory (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getQuoteHourlyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const endDate = moment().toDate();
        const startDate = moment().subtract(30, 'days').toDate(); // Use daily data for 30 days

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d',
            includeAdjustedClose: false
        };

        const response: any = await limiter.schedule(() => yahooFinance.default.chart(quote.toUpperCase(), queryOptions as any));
        
        if (!response?.quotes || response.quotes.length === 0) {
            return { candles: [], symbol: quote.toUpperCase(), empty: true };
        }

        // Convert chart response to historical format
        const chartData = response.quotes.map((quoteData: any) => ({
            date: new Date(quoteData.date),
            open: quoteData.open || 0,
            high: quoteData.high || 0,
            low: quoteData.low || 0,
            close: quoteData.close || 0,
            volume: quoteData.volume || 0
        }));
        
        return convertYahooToTDPriceHistory(convertUtils.convertYahooToTDAmeritradeFormat(chartData), quote);
    } catch (err) {
        logger.error('getQuoteHourlyHistory (Yahoo) failed: ' + err);
        throw err;
    }
};

export const getMarketHours = async (tradeDate: string): Promise<any> => {
    try {
        // Yahoo Finance doesn't provide market hours API directly
        // Return default market hours based on US market schedule
        const marketHours = quoteUtils.generateDefaultMarketHours();
        
        logger.info('Using default market hours as Yahoo Finance does not provide market hours API');
        
        return {
            equity: {
                EQ: {
                    date: tradeDate,
                    sessionHours: {
                        preMarket: [{
                            start: moment.tz(tradeDate, 'America/New_York').hour(4).minute(0).format(),
                            end: moment.tz(tradeDate, 'America/New_York').hour(9).minute(30).format()
                        }],
                        regularMarket: [{
                            start: moment.tz(tradeDate, 'America/New_York').hour(9).minute(30).format(),
                            end: moment.tz(tradeDate, 'America/New_York').hour(16).minute(0).format()
                        }],
                        postMarket: [{
                            start: moment.tz(tradeDate, 'America/New_York').hour(16).minute(0).format(),
                            end: moment.tz(tradeDate, 'America/New_York').hour(20).minute(0).format()
                        }]
                    }
                }
            }
        };
    } catch (err) {
        logger.error('getMarketHours (Yahoo) failed: ' + err);
        throw err;
    }
};

// Rate limiter event handlers
limiter.on('failed', function (error, jobInfo) {
    logger.error('Failed Yahoo Finance API call Error: ' + error);
    
    if (jobInfo.retryCount <= 5) { // Retry up to 5 times
        logger.info(`Retrying Yahoo Finance API call in 10 seconds (try #${jobInfo.retryCount})...`);
        return 10000; // 10 second delay
    }
    logger.info(`Aborting Yahoo Finance job after 5 retries`);
});

limiter.on('debug', function (message, data) {
    // Useful for debugging the rate limiter
    // Uncomment for debugging:
    // console.log('Yahoo Finance Rate Limiter:', message, data);
});
