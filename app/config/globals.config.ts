import { BehaviorTypes, SignalGroupType } from '../models/enums';

export const Mock = {
    IsMock: false,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2024-01-10',
    MockDataLiveSimulationTime:"15:30:00" ,
    intervalLapTime:"*/30 * * * * *" // "*/30 * * * * *" = every 30 seconds; "*/1 * * * *" = every 1 minute
    
};

export const ShouldUsePushNotifications = true;

export const Notifications = {
    usePush :true,
    allowedNotifications: {
        groupTypes: [
            // SignalGroupType.BULLISH_VOLUME,
            // SignalGroupType.BULLISH_COMBO,
            //SignalGroupType.BEARISH_COMBO,
            // SignalGroupType.HOURLY_MOVING_AVERAGE,
            //SignalGroupType.PRE_OPEN_SIGNAL,
            //SignalGroupType.HAMMER_COMBO,
            SignalGroupType.INITIATED,
            SignalGroupType.DEEP_OR_PEAK
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
                "MMM","ZM","HUT","JNPR","SATS",
                "DELL","VALE","LYFT","S","IOT","NTNX","HAL","ZI","RUN","SQ","ZIM","CSCO","KR","GPS",
                "BABA","BIDU","PFE","MRNA","MBLY","FTNT","PTGX","LI","NCLH","PATH","SOFI","F","CHWY",
                "SHOP","ADBE","CRM","AMAT","SBUX","PINS","CVNA","XOM","GME","MTCH","AI","NOW","DDOG","BX","ARM","PSTG" ,"TDOC",
                "TWLO","SPLK","UPST","AFRM","ROKU","INTC","AAL","MRVL","MARA","COIN","RIOT","JOBY","NKE","DWAC","CARR",
                "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","MDB","ENPH","SEDG","PLUG","QS","LMND","ON","DAL","UAL","LUV",
                "ABNB","DOCU","NOVA","UBER","IBM","TGT","OXY","GM","CE","HON","ASAN","HOOD","PDD","TOST","HPE","FOLD","AEHR","SE",
                "UPS","U","RBLX","CMG","UNH","ETSY","SSYS","DASH","PLTR","WDC","IONQ","AVGO","NIO","XPEV","FSLR","CCL","PAGS",
                "FVRR","AXSM","PYPL","CRWD","PANW","FDX","MCD","GS","JPM","MS","BAC","KEY","ROIV","WRK","TLRY","NU",
                "HD","KO","WMT","DIS","APPS","MU","TSM","QCOM","RIVN","FSR","SNAP","BNTX","HYLN","NKLA"  
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
            ],
            signals:[
    
            ],
            names:[
                //"PANW"
                

                "MMM","ZM","HUT","JNPR",
                "DELL","VALE","LYFT","S","IOT","NTNX","HAL","ZI","RUN","SQ","ZIM","CSCO","KR","GPS",
                "BABA","BIDU","PFE","MRNA","MBLY","FTNT","PTGX","LI","NCLH","PATH","SOFI","F","CHWY",
                "SHOP","ADBE","CRM","AMAT","SBUX","PINS","CVNA","XOM","GME","MTCH","AI","NOW","DDOG","BX","ARM","PSTG" ,"TDOC",
                "TWLO","SPLK","UPST","AFRM","ROKU","INTC","AAL","MRVL","MARA","COIN","RIOT","JOBY","NKE","DWAC","CARR",
                "DKNG" ,"SAVA","BYND","SNOW","SPOT","FUBO","TEAM","CVX","MDB","ENPH","SEDG","PLUG","QS","LMND","ON","DAL","UAL","LUV",
                "ABNB","DOCU","NOVA","UBER","IBM","TGT","OXY","GM","CE","HON","ASAN","HOOD","PDD","TOST","HPE","FOLD","AEHR","SE",
                "UPS","U","RBLX","CMG","UNH","ETSY","SSYS","DASH","PLTR","WDC","IONQ","AVGO","NIO","XPEV","FSLR","CCL","PAGS",
                "FVRR","AXSM","PYPL","CRWD","PANW","FDX","MCD","GS","JPM","MS","BAC","KEY","ROIV","WRK","TLRY","NU",
                "HD","KO","WMT","DIS","APPS","MU","TSM","QCOM","RIVN","FSR","SNAP","BNTX","HYLN","NKLA"  

                
                // "NCLH","TZA","XLF"
                //'AMD', 'KO', 'MARA', 'ARM', 'ORCL', 'HUT', 'RIOT', 'NCLH', 'TSM', 'BAC', 'PLTR', 'XOM', 'XLE', 'UAL', 'RUN', 'U', 'IWM', 'TLRY', 'TZA', 'ROKU', 'HPE', 'UBER', 'PLUG', 'CHWY', 'PYPL', 'QS', 'DKNG', 'LYFT', 'GM', 'SQQQ', 'OXY', 'DAL', 'INTC', 'PDD', 'CVX', 'PINS', 'TSLA', 'AMZN', 'DELL', 'META', 'MU', 'MRVL', 'SNAP', 'NVDA', 'XLF'
            ],
        },
    }
    
}
