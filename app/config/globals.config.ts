import { BehaviorTypes } from '../models/enums';

export const Mock = {
    IsMock: true,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2023-06-23',
    MockDataLiveSimulationTime:"09:25:00" ,
    intervalLapTime:"*/30 * * * * *" // "*/30 * * * * *" = every 30 seconds; "*/1 * * * *" = every 1 minute
    
};

export const ShouldUsePushNotifications = true;

export const Notifications = {
    usePush :true,
    sendComboOnly:true
};

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
                "SPCE","HYLN","BABA","BIDU","PFE","MRNA","MBLY","FTNT","LULU","UCAR","PTGX","LI","NCLH","PATH","SHOP","ADBE","CRM","AMAT","ZM","GETY","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                "TWLO","SPLK","UPST","AFRM","ROKU","INTC","LUV","AAL","MRVL","MARA","COIN","RIOT",
                "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","GCT",
                "ABNB","TTD","DOCU","NOVA","UBER","V","MA","IBM","TGT",
                "UPS","U","RBLX","CMG","UNH","RH","ETSY","SSYS","DASH","PLTR","WDC","IONQ",
                "FVRR","AXSM","BBIB","SQ","PYPL","CRWD","PANW","FDX","ZIM","MCD",
                "HD","KO","WMT","DIS","T","CSCO","APPS","MU","TSM","QCOM","RIVN","FSR"
            ],
        },
    },
    testing : {
        indexes:{
            behaviors:[],
            signals:[],
            names:["SPY","QQQ"],
        },
        leaders:{
            behaviors:[],
            signals:[],
            names:[
                // "AMZN"
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
                // BehaviorTypes.DeprecateIfNotAboveMovingAverages
            ],
            signals:[
    
            ],
            names:[ 
                // "AI",
                "NKLA","BABA","BIDU","PFE","MRNA","MBLY","FTNT","LULU","UCAR","PTGX","LI","NCLH","PATH","SHOP","ADBE","CRM","AMAT","ZM","GETY","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                "TWLO","SPLK","UPST","AFRM","ROKU","INTC","LUV","AAL","MRVL","MARA","COIN","RIOT",
                "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","GCT",
                "ABNB","TTD","DOCU","NOVA","UBER","V","MA","IBM","TGT",
                "UPS","U","RBLX","CMG","UNH","RH","ETSY","SSYS","DASH","PLTR","WDC","IONQ",
                "FVRR","AXSM","BBIB","SQ","PYPL","CRWD","PANW","FDX","ZIM","MCD",
                "HD","KO","WMT","DIS","T","CSCO","APPS","MU","TSM","QCOM","RIVN","FSR"
            ],
        },
    }
    
}
