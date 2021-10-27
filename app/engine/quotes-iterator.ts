const schedule = require('node-schedule');
import moment from 'moment-timezone';

import * as quoteUtils from '../utils/quote-utils';
import { INTERVAL_TIME } from '../config/globals.config';
import { logger } from '../config/winston.config';

import { ProxyService } from '../proxy/proxy-service';
import { QuoteMonoRunner } from './quote-mono-reader';

import { IQuotes, IQuoteFullIntervalData, IQuoteMetadata, IMarketHours } from '../models/quote-data.model';

export class QuotesIterator {
    private proxyService: ProxyService;
    private quotes: IQuotes = {};
    private quoteIndex: {[key:string]:number}={};
    private marketHours = {} as IMarketHours;
    private initializationTime!:Date

    constructor(quotes: string[] = []) {
        this.proxyService = new ProxyService();

        this.initializeQuotes(quotes);
    }

    public async initializeQuotesData(initTime:Date): Promise<any> {
        this.initializationTime=initTime;
        try {

            await this.proxyService.initialize();
            this.marketHours = this.proxyService.marketHours;

            for (let i = 0; i < Object.keys(this.quotes).length; i++) {
                const quoteKey = Object.keys(this.quotes)[i];
                const quoteIntervals = await this.proxyService.getTDAmeritradeIntraday(quoteKey);
                const quoteMetadata = await this.proxyService.getMetaDataPerDay(quoteKey, quoteUtils.getCurrentTradingDate(), quoteIntervals, this.marketHours);
                this.quotes[quoteKey].initializeStockData(quoteIntervals, quoteMetadata, this.marketHours);
                this.quoteIndex[quoteKey] =i;
                this.initiateQuoteWatch(quoteKey);
                
            }
            return Promise.resolve();
        } catch (err) {
            Promise.reject(err);
        }
    }

    public async initiateQuotesWatch() {
        let i = 0;
        if (Object.keys(this.quotes).length > 0) {
            const iterateStockInterval = setInterval(async () => {
                await this.iterateQuotes();
                if (Object.keys(this.quotes).length === 0) {
                    clearInterval(iterateStockInterval);
                }
            }, INTERVAL_TIME + i++ * 100);
        } else {
            throw Error('No Stocks were initialized');
        }
    }

    initiateQuoteWatch(quoteName: string) {
        const nextRunTime = moment(this.initializationTime).add(INTERVAL_TIME+this.quoteIndex[quoteName], 'ms').toDate();

        schedule.scheduleJob(nextRunTime, async () => {

            const quoteSetInteval = setInterval(async () => {
                if (!this.quotes.hasOwnProperty(quoteName)) {
                    clearInterval(quoteSetInteval);
                }
                await this.iterateQuote(quoteName);
            }, INTERVAL_TIME);

            await this.iterateQuote(quoteName);
        });
        
    }

    private initializeQuotes(quotes: string[]) {
        quotes.forEach((quote) => {
            this.quotes[quote] = new QuoteMonoRunner(quote);
        });
    }

    private async iterateQuote(quoteName: string) {
        try {

            const quoteStockStats: QuoteMonoRunner = this.quotes[quoteName];

            const data = await this.proxyService.getTDAmeritradeIntraday(quoteName, false);

            const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(data);
            quoteStockStats.recordNewStockInterval(stockInterval, true);

            this.clearQuoteWhenIsLastInterval(quoteName, stockInterval);
        } catch (err) {
            logger.error('error at Stock-Reader.iterateStocks - quote=' + quoteName + ' + ' + 'err=' + err);
        }
    }
    private async iterateQuotes() {
        for (let i = 0; i < Object.keys(this.quotes).length; i++) {
            const quoteKey = Object.keys(this.quotes)[i];
            try {
                const quoteStockStats: QuoteMonoRunner = this.quotes[quoteKey];

                const data = await this.proxyService.getTDAmeritradeIntraday(quoteKey, false);

                const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(data);
                quoteStockStats.recordNewStockInterval(stockInterval, true);

                this.clearQuoteWhenIsLastInterval(quoteKey, stockInterval);
            } catch (err) {
                logger.error('error at Stock-Reader.iterateStocks - quote=' + quoteKey + ',index=' + i + 'err=' + err);
            }
        }
    }

    private clearQuoteWhenIsLastInterval(quoteKey: string, interval: IQuoteFullIntervalData) {
        if (this.isLastInterval(interval)) {
            delete this.quotes[quoteKey];
            logger.debug('Terminating quote ' + quoteKey);
        }
    }

    private isLastInterval(interval: any): boolean {
        return interval.timeNewYork.getHours() === 15 && interval.timeNewYork.getMinutes()===50;
    }
}
