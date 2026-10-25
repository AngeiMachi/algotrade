import { BehaviorTypes, SignalGroupType } from '../models/enums';

export const Mock = {
    IsMock: false,
    startAtOpen:false,
    StartLiveSimulationAtInterval: 100,
    MockDataDate: '2024-04-19',
    MockDataLiveSimulationTime:"15:30:00" ,
    intervalLapTime:"*/30 * * * * *" // "*/30 * * * * *" = every 30 seconds; "*/1 * * * *" = every 1 minute
};

export const ShouldUsePushNotifications = false;

export const ShowStarRating = false;

export const RunSignals = false;

export const PremarketRace = {
    direction: 'long' as 'long' | 'short',
    premarketStart: '04:00', // New York time
    decisionWindowStart: '09:15', // last three 5-minute candles before the bell
    // Inside the decision window the board also counts the 5-minute candle still forming, refreshed this often (live only;
    // the simulation steps one minute per lap there instead).
    formingCandleRefreshSeconds: 20,
    smaPeriod: 20, // 24-hour hourly candles (regular + extended + overnight sessions)
    excludeGroups: ['indexes'],
    // rule thresholds and scoring weights: app/config/race-rules.config.ts
};

export const Notifications = {
    usePush :false,
    allowedNotifications: {
        groupTypes: [
            // SignalGroupType.BULLISH_VOLUME,
            // SignalGroupType.BULLISH_COMBO,
            //SignalGroupType.BEARISH_COMBO,
            // SignalGroupType.HOURLY_MOVING_AVERAGE,
            //SignalGroupType.PRE_OPEN_SIGNAL,
            //SignalGroupType.HAMMER_COMBO,
            //SignalGroupType.INITIATED,
            SignalGroupType.DEEP_OR_PEAK
        ]
    },
    socialAllowedNotifications: { 
        groupTypes: [
            // SignalGroupType.BULLISH_VOLUME,
            // SignalGroupType.BULLISH_COMBO,
            //SignalGroupType.BEARISH_COMBO,
            // SignalGroupType.HOURLY_MOVING_AVERAGE,
            //SignalGroupType.PRE_OPEN_SIGNAL,
            //SignalGroupType.HAMMER_COMBO,
            //SignalGroupType.INITIATED,
            //SignalGroupType.DEEP_OR_PEAK
        ]
    }
};

// Which list in QuotesConfig the engine follows. 'development' is a handful of stocks so restarts load fast.
export const ActiveQuotesList: keyof typeof QuotesConfig = 'producion';

export const QuotesConfig = {
    development: {
        // SPY sets the clock in mock runs; the indexes group is kept out of the race.
        indexes: {
            behaviors: [],
            signals: [],
            names: ["SPY"],
        },
        development: {
            behaviors: [],
            signals: [],
            names: ["AFRM", "TSLA", "AAPL", "MSFT", "CRCL"],
        },
    },
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
            names:[
                "SPCX","MA","AAP","SKHY","AMKR","NXPI","CBRS","CRWV","NBIS","ALAB","GLW","SNDK","APLD",
                "WOLF","ECHO","CRCL","BE","EBAY","HIMS","ASTS","IREN","TEM","RTX","NNE","OKLO","RKLB","VKTX","NET","V","RH","XYZ","RDDT"
            ],
        },
        smallcap:{
            behaviors:[
                //BehaviorTypes.DeprecateIfNotAboveMovingAverages
                // {behavior:BehaviorTypes.DeprecateIfAvarageVolumeisLessThan,values:[1]}
            ],
            signals:[
    
            ],
            names:[
                "MMM","ZM","HUT","JNPR","MDT",
                "DELL","LYFT","S","IOT","NTNX","HAL","ZIM","CSCO",
                "BABA","BIDU","PFE","MRNA","FTNT","PTGX","NCLH","SOFI","CHWY",
                "SHOP","ADBE","CRM","AMAT","SBUX","PINS","CVNA","XOM","GME","MTCH","NOW","DDOG","BX","ARM","TWLO","SMCI","UPST","AFRM","ROKU","INTC","MRVL","COIN","RIOT","NKE","CARR",
                "DKNG" ,"SNOW","SPOT","TEAM","CVX","MDB","ENPH","SEDG","LMND","ON","DAL","UAL","LUV",
                "ABNB","DOCU","UBER","IBM","TGT","OXY","GM","CE","HON","HOOD","PDD","TOST","HPE","AEHR","SE",
                "UPS","U","RBLX","CMG","UNH","ETSY","DASH","PLTR","WDC","IONQ","AVGO","FSLR","CCL","AXSM","PYPL","CRWD","PANW","FDX","MCD","GS","JPM","MS","BAC","KEY","ROIV","NU",
                "HD","KO","WMT","DIS","MU","TSM","QCOM","BKNG","LMT"
            ],
        },
    }
    
}
