const schedule = require('node-schedule');

import * as quoteUtils from '../utils/quote-utils';
import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';

import * as  proxyService  from '../proxy/proxy-service';
import { QuoteMonoRunner } from './quote-mono-reader';
import * as behaviorManager from './behavior-manager';
import { IQuotes, IQuoteFullIntervalData } from '../models/quote-data.model';


let quotes: IQuotes = {};
let quoteIndex: {[key:string]:number}={};

   
export const initializeQuotesData = async (quoteNames: string[] ):Promise<any> => {
    try {
        for (let i = 0; i < quoteNames.length; i++) {
            const quoteName = quoteNames[i];
            await addNewQuote(quoteName);
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

export const addNewQuote = async (quoteName: string)=> {
    quotes[quoteName] = new QuoteMonoRunner(quoteName);
    const quoteIntervals = await proxyService.getTDAmeritradeIntraday(quoteName);
    if (Object.keys(quoteIntervals).length==0) {
        delete quotes[quoteName];
        logger.error('error at Stock-Reader.initializeQuotesData - quote=' + quoteName + ' does not Exist and being deprecated');
        return;
    }

    const quoteMetadata = await proxyService.getMetaDataPerDay(quoteName, quoteUtils.getCurrentTradingDate());
    if (!quoteMetadata) {
        delete quotes[quoteName];
        logger.error('error at Stock-Reader.initializeQuotesData - quote=' + quoteName + ' could not load metadata and being deprecated');
        return;
    }

    behaviorManager.manangeAfterMetadata(quoteName,quoteMetadata,quotes);
    if (quotes[quoteName]) {
        quotes[quoteName].initializeStockData(quoteIntervals, quoteMetadata);
    }

}
export const initiateQuoteWatch=(quoteName: string)=> {
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
const iterateQuotes= () => {
    for (let i = 0; i < Object.keys(quotes).length; i++) {
        const quoteKey = Object.keys(quotes)[i];
        try {
            const quoteStockStats: QuoteMonoRunner = quotes[quoteKey];

            
            proxyService.getTDAmeritradeIntraday(quoteKey, true).then(quoteIntervals=>{
                const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
                
                if (quoteIntervals) {
                    quoteStockStats.recordQuoteIntervalsIncludingMissed(quoteIntervals, true);
                }
                clearQuoteWhenIsLastInterval(quoteKey, stockInterval);
            });

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
    if (!interval) {
        return false;
    }
    return interval?.timeNewYork.getHours() === 15 && interval.timeNewYork.getMinutes()===50;
}
