const schedule = require('node-schedule');
import * as _ from 'lodash';

import * as quoteUtils from '../utils/quote-utils';
import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';

import * as  proxyService  from '../proxy/proxy-service';
import { QuoteMonoRunner } from './quote-mono-reader';
import * as behaviorManager from './behavior-manager';
import * as premarketRace from './premarket-race';
import { IQuotes, IQuoteFullIntervalData, IQuoteIntervals } from '../models/quote-data.model';


let quotes: IQuotes = {};
let quoteIndex: {[key:string]:number}={};

   
export const initializeQuotesData = async (quoteNames: string[] ):Promise<any> => {
    try {
        // SPY sets the mock clock; the rest load in parallel so the Alpaca client can batch their requests.
        const [clockQuotes, otherQuotes] = _.partition(quoteNames, (quoteName) => quoteName === 'SPY');
        for (const quoteName of clockQuotes) {
            await addNewQuote(quoteName);
        }
        await Promise.all(
            otherQuotes.map((quoteName) =>
                addNewQuote(quoteName).catch((err) => {
                    delete quotes[quoteName];
                    logger.error('error at quotes-iterator.initializeQuotesData - quote=' + quoteName + ' err=' + err);
                })
            )
        );
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

    if (!globalConfig.Mock.IsMock) {
        schedule.scheduleJob(`*/${globalConfig.PremarketRace.formingCandleRefreshSeconds} * * * * *`, refreshFormingCandles);
    }
}

const refreshFormingCandles = () => {
    if (!proxyService.isFormingCandleWindow()) {
        return;
    }
    Object.keys(quotes).forEach((quoteName) => updateRace(quoteName, {}));
};

const updateRace = async (quoteName: string, completedIntervals: IQuoteIntervals) => {
    try {
        const intervals = proxyService.isFormingCandleWindow() ? await proxyService.getIntraday5MinuteWithFormingCandle(quoteName) : completedIntervals;
        premarketRace.updateQuote(quoteName, intervals);
    } catch (err) {
        logger.error('error at quotes-iterator.updateRace - quote=' + quoteName + ' err=' + err);
    }
};

export const addNewQuote = async (quoteName: string)=> {
    quotes[quoteName] = new QuoteMonoRunner(quoteName);
    const quoteIntervals = await proxyService.getIntraday5Minute(quoteName);
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
        premarketRace.registerQuote(quoteName, quoteIntervals, quoteMetadata);
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

        const quoteIntervals = await proxyService.getIntraday5Minute(quoteName, true);

        const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
        quoteStockStats.recordQuoteIntervalsIncludingMissed(quoteIntervals, true);
        await updateRace(quoteName, quoteIntervals);

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

            
            proxyService.getIntraday5Minute(quoteKey, true).then(quoteIntervals=>{
                const stockInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
                
                if (quoteIntervals) {
                    quoteStockStats.recordQuoteIntervalsIncludingMissed(quoteIntervals, true);
                    updateRace(quoteKey, quoteIntervals);
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
