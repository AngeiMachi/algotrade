import { BehaviorTypes } from '../models/enums';

export const Mock = {
    IsMock: false,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2023-05-31',
    MockDataLiveSimulationTime:"10:00:00" ,
    intervalLapTime:"*/120 * * * * *"// "/30 * * * * *" = every 30 seconds;
    
};
export const ShouldUsePushNotifications = true;

export const QuotesConfig = {
    producion: {
        indexes:{
            behaviors:[],
            signals:[],
            names:["SPY","QQQ","IWM","SQQQ","TQQQ","XLE","XLF","JETS","ARKK","SMH","TZA"],
        },
        leaders:{
            behaviors:[],
            signals:[],
            names:["AAPL","AMZN","TSLA","MSFT","META","BA","GOOGL","AMD","NVDA","CAT","ORCL","GE"],
        },
        trending:{
            behaviors:[],
            signals:[],
            names:[],
        },
        smallcap:{
            behaviors:[
                BehaviorTypes.DeprecateIfNotAboveMovingAverages
            ],
            signals:[
    
            ],
            names:[
                "NCLH","PATH","SHOP","ADBE","CRM","AMAT","ZM","GETY","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                "TWLO","APLK","UPST","AFRM","ROKU","INTC","LUV","AAL","MRVL","MARA","COIN","RIOT",
                "DKNG","SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","GCT",
                "ABNB","TTD","DOCU","NOVA","UBER","V","MA","IBM","TGT",
                "UPS","U","RBLX","CMG","UNH","RH","ETSY","SSYS","DASH","PLTR","WDC","IONQ",
                "FVRR","AXSM","VERU","BBIB","SQ","PYPL","CRWD","PANW","FDX","ZIM","MCD",
                "HD","KO","WMT","DIS","T","CSCO","APPS"
            ],
        },
    },
    testing : {
        indexes:{
            behaviors:[],
            signals:[],
            names:["SPY","QQQ","IWM","SQQQ","TQQQ","XLE","XLF","JETS","ARKK","SMH","TZA"],
        },
        leaders:{
            behaviors:[],
            signals:[],
            names:[
                 "AAPL","AMZN","TSLA","MSFT","META","BA","GOOGL","AMD","NVDA","CAT","ORCL","GE"
            ],
        },
        trending:{
            behaviors:[],
            signals:[],
            names:[],
        },
        smallcap:{
            behaviors:[
                BehaviorTypes.DeprecateIfNotAboveMovingAverages
            ],
            signals:[
    
            ],
            names:[
                "PATH","SHOP","ADBE","CRM","AMAT","ZM","GETY","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                "TWLO","APLK","UPST","AFRM","ROKU","INTC","LUV","AAL","MRVL",
                "DKNG","SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","GCT",
                "ABNB","TTD","DOCU","NOVA","UBER","V","MA","IBM","TGT",
                "UPS","U","RBLX","CMG","UNH","RH","ETSY","SSYS","DASH","PLTR","WDC",
                "FVRR","AXSM","VERU","BBIB","SQ","PYPL","CRWD","PANW","FDX","ZIM","MCD",
                "HD","KO","WMT","DIS","T","CSCO","APPS"
            ],
        },
    }
    
}
