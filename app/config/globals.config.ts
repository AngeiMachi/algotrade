export const Mock = {
    IsMock: false,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2023-01-12',
    MockDataLiveSimulationTime:"13:00:00" ,
    intervalLapTime:"*/3 * * * * *"// "/30 * * * * *" = every 30 seconds;
    
};
export const ShouldUsePushNotifications = true;

export const Quotes = {
    indexes:{
        behaviors:[],
        signals:[],
        names:["SPY","QQQ","IWM","SQQQ","TQQQ","XLE","XLF","JETS","ARKK","SMH","TZA"],
    },
    leaders:{
        behaviors:[],
        signals:[],
        names:["AAPL","AMZN","TSLA","MSFT","META","BA","GOOGL","AMD","NVDA","AMZN","CAT"],
    },
    trending:{
        behaviors:[],
        signals:[],
        names:[],
    },
    smallcap:{
        behaviors:[],
        signals:[],
        names:[],
    },
}
