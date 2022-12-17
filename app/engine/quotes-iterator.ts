const schedule = require('node-schedule');
import moment from 'moment-timezone';

import * as quoteUtils from '../utils/quote-utils';
import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';

import * as  proxyService  from '../proxy/proxy-service';
import { QuoteMonoRunner } from './quote-mono-reader';

import { IQuotes, IQuoteFullIntervalData } from '../models/quote-data.model';


let quotes: IQuotes = {};
let quoteIndex: {[key:string]:number}={};

   
export const initializeQuotesData = async (quoteNames: string[] ):Promise<any> => {

    initializeQuotes(quoteNames);

    let quoteKey:string='';
    try {
        for (let i = 0; i < Object.keys(quotes).length; i++) {
            quoteKey = Object.keys(quotes)[i];

            const quoteIntervals = await proxyService.getTDAmeritradeIntraday(quoteKey);
            if (Object.keys(quoteIntervals).length==0) {
                delete quotes[quoteKey];
                logger.error('error at Stock-Reader.initializeQuotesData - quote=' + quoteKey + ' does not Exist and being deprecated');
                continue;
            }
            const quoteMetadata = await proxyService.getMetaDataPerDay(quoteKey, quoteUtils.getCurrentTradingDate());

            if (!quoteMetadata) {
                delete quotes[quoteKey];
                logger.error('error at Stock-Reader.initializeQuotesData - quote=' + quoteKey + ' could not load metadata and being deprecated');
                continue;
            }
            quotes[quoteKey].initializeStockData(quoteIntervals, quoteMetadata);
            quoteIndex[quoteKey] =i;
            //initiateQuoteWatch(quoteKey);
        }
        return Promise.resolve();
    } catch (err) {
        Promise.reject(err);
    }
}

export const initiateQuotesWatch = ()=> {
    let runCron="5 0,5,10,15,20,25,30,35,40,45,50,55  * * * *";
    if (globalConfig.Mock.IsMock && globalConfig.Mock?.intervalLapTime) {
        runCron = globalConfig.Mock?.intervalLapTime;
    } 
    
    schedule.scheduleJob(runCron, async () => {
        await iterateQuotes();
    });
}

export const initiateQuoteWatch=(quoteName: string)=> {
    //const nextRunTime = moment(this.initializationTime).add(INTERVAL_TIME+this.quoteIndex[quoteName], 'ms').toDate();
    let runCron="5 0,5,10,15,20,25,30,35,40,45,50,55  * * * *";
    if (globalConfig.Mock.IsMock && globalConfig.Mock?.intervalLapTime) {
        runCron = globalConfig.Mock?.intervalLapTime;
    } 
    
    schedule.scheduleJob(runCron, async () => {
        await iterateQuote(quoteName);
    });
}

const initializeQuotes=(quotesName: string[])=> {
    quotesName.forEach((quoteName) => {
        quotes[quoteName] = new QuoteMonoRunner(quoteName);
    });
}

const iterateQuote =  async (quoteName: string) =>{
    try {

        const quoteStockStats: QuoteMonoRunner = quotes[quoteName];

        const quoteIntervals = await proxyService.getTDAmeritradeIntraday(quoteName, true);

        const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
        quoteStockStats.recordQuoteIntervalsIncludingMissed(quoteIntervals, true);

        clearQuoteWhenIsLastInterval(quoteName, stockInterval);
    } catch (err) {
        logger.error('error at quotes-Iterator.iterateQuote - quote=' + quoteName + ' + ' + 'err=' + err);
    }
}
const iterateQuotes= async () => {
    for (let i = 0; i < Object.keys(quotes).length; i++) {
        const quoteKey = Object.keys(quotes)[i];
        try {
            const quoteStockStats: QuoteMonoRunner = quotes[quoteKey];

            const quoteIntervals = await proxyService.getTDAmeritradeIntraday(quoteKey, false);

            const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);

            quoteStockStats.recordQuoteIntervalsIncludingMissed(quoteIntervals, true);

            clearQuoteWhenIsLastInterval(quoteKey, stockInterval);
        } catch (err) {
            logger.error('error at quotes-iterator.iterateQuotes - quote=' + quoteKey + ',index=' + i + 'err=' + err);
        }
    }
}

const clearQuoteWhenIsLastInterval= (quoteKey: string, interval: IQuoteFullIntervalData) =>{
    if (isLastInterval(interval)) {
        delete quotes[quoteKey];
        logger.debug('Terminating quote ' + quoteKey);
    }
}

const isLastInterval=(interval: any): boolean => {
    return interval.timeNewYork.getHours() === 15 && interval.timeNewYork.getMinutes()===50;
}
