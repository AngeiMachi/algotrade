import { INTERVAL_TIME } from '../config/globals.config';
import * as environmentConfig from '../config/environment.Config.json';

import { QuotesIterator } from './quotes-iterator';

//const tdaclient = require('tda-api-client');

export default async function startApp() {
    try {
        const sr = new QuotesIterator(environmentConfig.quotes.quote6);
        sr.initializeQuotesData();
    } catch (error) {
        let i = error;
    }
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

// setTimeout(() => {
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
