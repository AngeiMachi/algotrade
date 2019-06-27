import {StockReader} from "./stock-reader";
import * as environmentConfig from "../config/environment.Config.json";

const sr = new StockReader( environmentConfig.AlphaVantageAPIKeys[0].key , [...environmentConfig.AlphaVantageAPIKeys[0].quotes]);
sr.initializeQuotesData();



/*var j = schedule.scheduleJob({hour: 10, minute: 30}, () =>{
    let startTime = new Date(Date.now());
    let endTime = new Date(startTime.getTime() +25200000)

 });*/
/*
// Simple examples
alpha.data.intraday(`googl`,'compact','json','5min').then(data => {
  console.log(data);
});
 
alpha.data.batch([`msft`, `aapl`]).then(data => {
  console.log(data);
});

alpha2.data.intraday('aapl','compact','json','5min').then(data => {
    console.log(data);
});

alpha2.data.daily_adjusted('aapl','compact','json','5min').then(data => {
    console.log(data);
});

alpha2.data.batch([`msft`, `aapl`]).then(data => {
    console.log(data);
});

alpha.technical.sma(`msft`, `daily`, 60, `close`).then(data => {
    console.log(data);
});*/