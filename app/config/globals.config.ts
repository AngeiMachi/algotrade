import { BehaviorTypes, SignalGroupType } from '../models/enums';

export const Mock = {
    IsMock: false,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2023-08-07',
    MockDataLiveSimulationTime:"09:05:00" ,
    intervalLapTime:"*/10 * * * * *" // "*/30 * * * * *" = every 30 seconds; "*/1 * * * *" = every 1 minute
    
};

export const ShouldUsePushNotifications = true;

export const Notifications = {
    usePush :true,
    allowedNotifications: {
        groupTypes: [
            SignalGroupType.BULLISH_VOLUME,
            SignalGroupType.BULLISH_COMBO,
            SignalGroupType.BEARISH_COMBO,
            SignalGroupType.HOURLY_MOVING_AVERAGE,
            SignalGroupType.HAMMER_COMBO
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
                // BehaviorTypes.DeprecateIfNotAboveMovingAverages
                // {behavior:BehaviorTypes.DeprecateIfAvarageVolumeisLessThan,values:[1]}
            ],
            signals:[
    
            ],
            names:[
                "PFE","MRNA","LI","NCLH","F","BABA","SOFI","RUN",
                "SHOP","CRM","SBUX","PINS","CVNA","GME","MTCH","AI","DDOG","AMC",
                "UPST","AFRM","ROKU","INTC","AAL","MARA","COIN","RIOT","NKE",
                "DKNG" ,"BYND","SNOW","FUBO","TEAM","CVX","PLUG","QS","DAL",
                "ABNB","TGT","GM","HOOD",
                "UPS","U","RBLX","DASH","PLTR","IONQ","NIO","XPEV","CCL",
                "FDX","MCD","GS","JPM","MS","BAC",
                "HD","KO","WMT","DIS","APPS","MU","RIVN","FSR","SNAP",
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
                "GOOGL"
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
                // "BABA","BIDU","PFE","MRNA","MBLY","FTNT","UCAR","PTGX","LI","NCLH","PATH","SOFI","F","CHWY",
                // "SHOP","ADBE","CRM","AMAT","SBUX","PINS","CVNA","XOM","GME","MTCH","AI","NOW","DDOG",
                // "TWLO","SPLK","UPST","AFRM","ROKU","INTC","AAL","MRVL","MARA","COIN","RIOT","JOBY","NKE",
                // "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","MDB","ENPH","PLUG","QS","LMND","ON","DAL",
                // "ABNB","DOCU","NOVA","UBER","IBM","TGT","OXY","GM","CE","HON","ASAN","HOOD","PDD","TOST","HPE","FOLD","AEHR",
                // "UPS","U","RBLX","CMG","UNH","ETSY","SSYS","DASH","PLTR","WDC","IONQ","AVGO","NIO","XPEV","FSLR","CCL","PAGS",
                // "FVRR","AXSM","PYPL","CRWD","PANW","FDX","MCD","GS","JPM","MS","BAC","KEY",
                // "HD","KO","WMT","DIS","APPS","MU","TSM","QCOM","RIVN","FSR","SNAP","BNTX"   
                     ],
        },
    }
    
}
