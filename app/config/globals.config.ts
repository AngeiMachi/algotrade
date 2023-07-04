import { BehaviorTypes, SignalGroupType } from '../models/enums';

export const Mock = {
    IsMock: true,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2023-07-03',
    MockDataLiveSimulationTime:"12:25:00" ,
    intervalLapTime:"*/5 * * * * *" // "*/30 * * * * *" = every 30 seconds; "*/1 * * * *" = every 1 minute
    
};

export const ShouldUsePushNotifications = true;

export const Notifications = {
    usePush :true,
    allowedNotifications: {
        groupTypes: [
            SignalGroupType.BULLISH_VOLUME,
            SignalGroupType.BULLISH_COMBO,
            SignalGroupType.BEARISH_COMBO,
        ]
    }
};

export const QuotesConfig = {
    producion: {
        indexes:{
            behaviors:[],
            signals:[],
            names:["SPY","QQQ","IWM","DIA","SQQQ","TQQQ","XLE","XLF","JETS","ARKK","SMH","TZA"],
        },
        leaders:{
            behaviors:[],
            signals:[],
            names:[
                "AAPL","AMZN","TSLA","MSFT","META","BA","GOOGL","AMD","NVDA","CAT","ORCL","GE","NFLX"
            ],
        },
        trending:{
            behaviors:[],
            signals:[],
            names:[],
        },
        smallcap:{
            behaviors:[
                 //BehaviorTypes.DeprecateIfNotAboveMovingAverages
                // {behavior:BehaviorTypes.DeprecateIfAvarageVolumeisLessThan,values:[1]}
            ],
            signals:[
    
            ],
            names:[
                "BABA","BIDU","PFE","MRNA","MBLY","FTNT","UCAR","PTGX","LI","NCLH","PATH",
                "SHOP","ADBE","CRM","AMAT","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                "TWLO","SPLK","UPST","AFRM","ROKU","INTC","AAL","MRVL","MARA","COIN","RIOT","JOBY","NKE",
                "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","MDB","ENPH","PLUG","QS",
                "ABNB","DOCU","NOVA","UBER","IBM","TGT","OXY","GM","CE","HON",
                "UPS","U","RBLX","CMG","UNH","ETSY","SSYS","DASH","PLTR","WDC","IONQ","AVGO","NIO","XPEV","FSLR","CCL",
                "FVRR","AXSM","BBIB","PYPL","CRWD","PANW","FDX","MCD","GS","JPM","MS","BAC",
                "HD","KO","WMT","DIS","APPS","MU","TSM","QCOM","RIVN","FSR","SNAP","BNTX"
            ],
        },
    },
    testing : {
        indexes:{
            behaviors:[],
            signals:[],
            names:["SPY"],
        },
        leaders:{
            behaviors:[],
            signals:[],
            names:[ 
                 // "AAPL","AMZN","TSLA","MSFT","META","BA","GOOGL","AMD","NVDA","CAT","ORCL","GE"
            ],
        },
        trending:{
            behaviors:[],
            signals:[],
            names:[],
        },
        smallcap:{
            behaviors:[
                //BehaviorTypes.DeprecateIfNotAboveMovingAverages
            ],
            signals:[
    
            ],
            names:[
                "BAC"
                // "SPCE","HYLN","BABA","BIDU","PFE","MRNA","MBLY","FTNT","LULU","UCAR","PTGX","LI","NCLH","PATH",
                // "SHOP","ADBE","CRM","AMAT","ZM","GETY","SBUX","PINS","CVNA","XOM","GME","MTCH","AI",
                // "TWLO","SPLK","UPST","AFRM","ROKU","INTC","LUV","AAL","MRVL","MARA","COIN","RIOT","JOBY","NKE",
                // "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","GCT","MDB","ENPH","PLUG","QS",
                // "ABNB","TTD","DOCU","NOVA","UBER","V","MA","IBM","TGT","OXY","GM","CE","HON",
                // "UPS","U","RBLX","CMG","UNH","RH","ETSY","SSYS","DASH","PLTR","WDC","IONQ","AVGO","NIO","XPEV","FSLR","CCL",
                // "FVRR","AXSM","BBIB","SQ","PYPL","CRWD","PANW","FDX","ZIM","MCD","GS","JPM","MS","BAC",
                // "HD","KO","WMT","DIS","T","CSCO","APPS","MU","TSM","QCOM","RIVN","FSR","SNAP","BNTX"
            ],
        },
    }
    
}
