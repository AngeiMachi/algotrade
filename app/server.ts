import { StockHistoricalReader } from "./stock-historical-reader";
import * as environmentConfig from "./config/environment.Config.json";
import { StockReader } from "./stock-reader";
import * as TDAmeritradeAPI from "./td-ameritrade-api";

// const sr = new StockReader( environmentConfig.AlphaVantageAPIKeys[1].key , [...environmentConfig.AlphaVantageAPIKeys[1].quotes]);
// sr.initializeQuotesData().then(() => {
//     sr.initiateStockWatch();
// });

// TDAmeritradeAPI.getQuote5MinuteHistory("AMZN").then((intervals) => {
// });

//     console.log("AFTER RESOVE>>>");
// const shr = new StockHistoricalReader( environmentConfig.AlphaVantageAPIKeys[1].key ,
// [...environmentConfig.AlphaVantageAPIKeys[1].quotes]);
// shr.getQuotesHistoricalDataByAlphaVantage();

const shr = new StockHistoricalReader( environmentConfig.AlphaVantageAPIKeys[2].quotes , environmentConfig.AlphaVantageAPIKeys[2].key);
// shr.getBiggestDailyMoves(15);
shr.getQuotesHistoricalDataByTDAmeritrade(0 , [] );

// alpha2.data.daily_adjusted('aapl','compact','json','5min').then(data => {
//     console.log(data);
// });

// alpha2.data.batch([`msft`, `aapl`]).then(data => {
//     console.log(data);
// });

// alpha.technical.sma(`msft`, `daily`, 60, `close`).then(data => {
//     console.log(data);
// })
