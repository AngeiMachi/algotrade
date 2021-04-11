import moment from "moment-timezone";

import { StockHistoricalReader } from "./stock-historical-reader";
import * as environmentConfig from "./config/environment.Config.json";
import { StockReader } from "./stock-reader";
import * as TDAmeritradeAPI from "./proxy/td-ameritrade-api";
import { AsyncRevolver } from "./async-revolver";

// const sr = new StockReader(["AMD","ROKU","TSLA","DIS","AAPL","XLNX","NVDA","LULU","WDC","RH",
// "WYNN","PYPL","AVGO","EA","CRM","PANW","HD","UNH","AMZN"]);

const sr = new StockReader(environmentConfig.quotes.quote3);
sr.initializeQuotesData().then(() => {
    sr.initiateStockWatch();
});

//  TDAmeritradeAPI.getQuote5MinuteIntraday("AMZN","2019-08-09").then((intervals) => {
//  });

// //     console.log("AFTER RESOVE>>>");
// const shr = new StockHistoricalReader( environmentConfig.quotes.quote1);
// shr.getQuotesHistoricalDataByAlphaVantage();

// const shr = new StockHistoricalReader(environmentConfig.quotes.quote1);

// shr.getQuotesHistoricalDataByTDAmeritrade(0,["2019-08-28"]);

// alpha2.data.daily_adjusted('aapl','compact','json','5min').then(data => {
//     console.log(data);
// });

// alpha2.data.batch([`msft`, `aapl`]).then(data => {
//     console.log(data);
// });

// alpha.technical.sma(`msft`, `daily`, 60, `close`).then(data => {
//     console.log(data);
// })
