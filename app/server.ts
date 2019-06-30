import { StockHistoricalReader } from "./stock-historical-reader";
import * as environmentConfig from "./config/environment.Config.json";

// const sr = new StockReader( environmentConfig.AlphaVantageAPIKeys[0].key , [...environmentConfig.AlphaVantageAPIKeys[0].quotes]);
// sr.initializeQuotesData().then(() => {
//  sr.initiateStockWatch();
// });

const shr = new StockHistoricalReader( environmentConfig.AlphaVantageAPIKeys[0].key , [...environmentConfig.AlphaVantageAPIKeys[0].quotes]);
shr.getQuotesHistoricalData();


 /**
alpha2.data.daily_adjusted('aapl','compact','json','5min').then(data => {
    console.log(data);
});

alpha2.data.batch([`msft`, `aapl`]).then(data => {
    console.log(data);
});

alpha.technical.sma(`msft`, `daily`, 60, `close`).then(data => {
    console.log(data);
});*/