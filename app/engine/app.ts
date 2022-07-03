const schedule = require('node-schedule');
import moment from 'moment-timezone';
import { logger } from '../config/winston.config';
import * as environmentConfig from '../config/environment.Config.json';
import * as globalConfig from '../config/globals.config';

import { QuotesIterator } from './quotes-iterator';
import * as quoteCache from './quotes-cache';
//const tdaclient = require('tda-api-client');

const quotes = ["SPY"];

export default async function startApp() {
    try { 
        await quoteCache.cacheQuoteListFromTDAmeritradeAPI(environmentConfig.quotes.LEADERS);
        const sr = new QuotesIterator(environmentConfig.quotes.LEADERS);

        const initTime = calculateInitializationTime();
        logger.info(`Quote initialization is set to start at ${initTime}...`);
        const job = schedule.scheduleJob(initTime , ()=>{
            sr.initializeQuotesData(initTime);
        });
        
    } catch (error) {
        logger.error("StartApp="+ error);
    }
}

const calculateInitializationTime = ():Date=> {
    if (globalConfig.Mock.IsMock) {
        return moment(new Date()).add(10,'s').toDate();
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

   let date = moment(now).add(minutesToAdd, 'm').add(secondsToAdd,'s').toDate();
   return date;
}

// setTimeout(() => {
//     const sr = new QuotesIterator(environmentConfig.quotes.quote7);
//     sr.initializeQuotesData().then(() => {
//         sr.initiateQuotesWatch();
//     });
// }, 1000 * 61);

// setTimeout(() => {
//     const sr = new QuotesIterator(environmentConfig.quotes.quote8);
//     sr.initializeQuotesData().then(() => {
//         sr.initiateQuotesWatch();
//     });
// }, 1000 * 125);

// setTimeout(() = new  => {
//     const sr = new QuotesIterator(environmentConfig.quotes.quote9);
//     sr.initializeQuotesData().then(() => {
//         sr.initiateQuotesWatch();
//     });
// }, 1000 * 190);

// const sr = new StockReader( environmentConfig.AlphaVantageAPIKeys[1].key , [...environmentConfig.AlphaVantageAPIKeys[1].quotes]);
// sr.initializeQuotesData().then(() => {
//     sr.initiateStockWatch();
// });
// const configGetMarketHrs  = {
//     market: 'EQUITY',
//     date: '2021-07-12' ,
//     apikey: 'SNJJKMVVMG1DKLIVXDSPI6JF2JTG4W6J@AMER.OAUTHAP'
// };
// const account = async () =>  {
//     try  {
//         const hrs = await tdaclient.markethours.getSingleMarketHours(configGetMarketHrs);
//         const getQuoteConfig = {
//             symbol: 'F',
//             apikey:'SNJJKMVVMG1DKLIVXDSPI6JF2JTG4W6J@AMER.OAUTHAP'
//         };
//         const getQuoteResult = await tdaclient.quotes.getQuote(getQuoteConfig);
//         const priceHistoryConfig = {
//             startDate: new Date('2019-09-01 07:00:00').getTime(),
//             endDate: new Date('2020-09-01 16:00:00').getTime(),
//             periodType: tdaclient.pricehistory.PERIOD_TYPE.YEAR,
//             frequencyType: tdaclient.pricehistory.FREQUENCY_TYPE.YEAR.WEEKLY,
//             frequency: tdaclient.pricehistory.FREQUENCY.WEEKLY.ONE,
//             symbol: 'F',
//             getExtendedHours: 'true'
//         };
//         const configGetAcct = {
//             accountId: 490351831,
//             fields: 'positions,orders'
//         };
//         const getAcctResult = await tdaclient.accounts.getAccount(configGetAcct);
//         const getPriceHistoryResult = await tdaclient.pricehistory.getPriceHistory(priceHistoryConfig);
//         // GET AUTHENTICATION
//         const authConfig = await tdaclient.authentication.getAuthentication();
//         // REFRESH AUTHENTICATION
//         //const authConfig2 = await tdaclient.authentication.refreshAuthentication();
//         // GET INSTRUMENT
//         const configGetInst = {
//             cusip: 345370860,
//             apikey: 'SNJJKMVVMG1DKLIVXDSPI6JF2JTG4W6J@AMER.OAUTHAP'
//         };
//         const getInstrumentResult = await tdaclient.instruments.getInstrument(configGetInst);
//         // SEARCH INSTRUMENT
//         const configSearchInst = {
//             symbol: 'F',
//             projection: tdaclient.instruments.PROJECTION_TYPE.SYMBOL_SEARCH,
//             apikey:'SNJJKMVVMG1DKLIVXDSPI6JF2JTG4W6J@AMER.OAUTHAP'
//         };
//         const searchInstrumentResult = await tdaclient.instruments.searchInstruments(configSearchInst);
//         // GET SINGLE MARKET HOURS
//         const configGetMktHours = {
//             market: tdaclient.markethours.MARKETS.OPTION,
//             date: '2020-09-10',
//             apikey: 'SNJJKMVVMG1DKLIVXDSPI6JF2JTG4W6J@AMER.OAUTHAP'
//         };
//         const getSingleMarketHoursResult = await tdaclient.markethours.getSingleMarketHours(configGetMktHours);
//                 let y= 1;
//             }
//     catch (error)  {
//                 console.log(error);
//     }
//     let z=3;
// };

// account();

// let x=1;

// TDAmeritradeAPI.getQuote5MinuteHistory("AMZN").then((intervals) => {
// });

//     console.log("AFTER RESOVE>>>");
// const shr = new StockHistoricalReader( environmentConfig.AlphaVantageAPIKeys[1].key ,
// [...environmentConfig.AlphaVantageAPIKeys[1].quotes]);
// shr.getQuotesHistoricalDataByAlphaVantage();

//const shr = new StockHistoricalReader( environmentConfig.AlphaVantageAPIKeys[2].quotes , environmentConfig.AlphaVantageAPIKeys[2].key);
// shr.getBiggestDailyMoves(15);
//shr.getQuotesHistoricalDataByTDAmeritrade(0 , [] );

// alpha2.data.daily_adjusted('aapl','compact','json','5min').then(data => {
//     console.log(data);
// });

// alpha2.data.batch([`msft`, `aapl`]).then(data => {
//     console.log(data);
// });

// alpha.technical.sma(`msft`, `daily`, 60, `close`).then(data => {
//     console.log(data);
// })
