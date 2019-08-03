import moment from "moment-timezone";

import { StockHistoricalReader } from "./stock-historical-reader";
import * as environmentConfig from "./config/environment.Config.json";
import { StockReader } from "./stock-reader";
import * as TDAmeritradeAPI from "./proxy/td-ameritrade-api";
import { AsyncRevolver } from "./async-revolver";




// async function func() {
//     let revolver = new AsyncRevolver([1,2,3,4,5],3000,true,true);

//     setInterval(async ()=>{
//             let val =  await revolver.next("printing from first interval");
//             console.log("first interval="+ moment(new Date()).format("HH:mm:ss"),":",val);
//     },2222);

//     setInterval(async ()=>{
//             let val =  await revolver.next("printing from second interval");
//             console.log("second interval="+ moment(new Date()).format("HH:mm:ss"),":",val);
//     },4534);
//     for (let i=0;i<110;i++) {
//         let val =  await revolver.next("printing from for loop I ="+i);
//         console.log("for loop      I="+i+"="+ moment(new Date()).format("HH:mm:ss"),":",val);
//     }
    
// }

// func();



const sr = new StockReader(["ROKU","AMD","AMZN"]);
sr.initializeQuotesData().then(() => {
    sr.initiateStockWatch();
});

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
