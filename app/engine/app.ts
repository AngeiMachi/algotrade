const schedule = require('node-schedule');
import moment from 'moment-timezone';
import { logger } from '../config/winston.config';
import * as environmentConfig from '../config/environment.Config.json';
import * as globalConfig from '../config/globals.config';

import * as quotesIterator from './quotes-iterator';
import * as quoteCache from './quotes-cache';
//const tdaclient = require('tda-api-client');

const quotes = ["SPY","NFLX"];

export default async function startApp() {
    try {

        const quotesTofollow = environmentConfig.quotes.LEADERS;
        //const quotesTofollow =quotes;
        await quoteCache.cacheQuoteListFromTDAmeritradeAPI(quotesTofollow);

        const initTime = calculateInitializationTime();
        logger.info(`Quote initialization is set to start at ${initTime}...`);
        const job = schedule.scheduleJob(initTime ,async ()=>{
            await quotesIterator.initializeQuotesData(quotesTofollow);
            quotesIterator.initiateQuotesWatch();
        });
        
    } catch (error) {
        logger.error("StartApp="+ error);
    }
}

const calculateInitializationTime = ():Date=> {
    if (globalConfig.Mock.IsMock) {
        return moment(new Date()).add(2,'s').toDate();
    }

    const extraWaitTime =0;

    const now = new Date();
    const minutesDiff = now.getMinutes()%5 ;
    let minutesToAdd = 0;
    let secondsToAdd = 0;
    if(minutesDiff!==0) {
        minutesToAdd=5-minutesDiff;
    }
    const secondsDiff = now.getSeconds();
    if (secondsDiff<10) {
        secondsToAdd = extraWaitTime -secondsDiff
    } else if (secondsDiff > extraWaitTime) {
        secondsToAdd = 60-secondsDiff+extraWaitTime
        if (minutesToAdd===0) {
            minutesToAdd +=4;
        }
        else {
            minutesToAdd--;
        }
    }
   let date = moment(now).add(minutesToAdd, 'm').add(secondsToAdd+5,'s').toDate();
   return date;
}
