// const alpha = require('alphavantage')({ key: 'M2ADSGO7ANB9QO3O' });
// const alpha2 = require('alphavantage')({ key: 'S5AMKCFQEKG7S7DW' });
import {StockReader} from "./stock-reader";

const sr = new StockReader( "M2ADSGO7ANB9QO3O" ,[ "AAPL" , "BA" ]);
sr.initializeQuotesData();

//pushed.sendPushMessage("Hello Angel Macho");

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