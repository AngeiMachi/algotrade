import * as _ from 'lodash';

import * as quoteUtils from '../utils/quote-utils';
import * as generalUtils from '../utils/general'
import * as quoteState from './state';
import {  IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';
import { logger } from '../config/winston.config';
import { BullishHODSignal, 
         BullishLevelBreakSignal,
         BullishVolumeSignal,
         MovingAverageDailyTwentySignal,
         MovingAverageDailyFiftySignal, 
         MovingAveragesSignal,
         MovingAveragesHourlyBullish, 
         MovingAveragesFiftyHourlyBullish,
         BullishBuildingAboveTwentyMA,
         BullishMoveSequenceSignal } 
         from '../signals';
import { QuoteStatistics } from './quote-statistics';
import { SignalModel } from '../models/signal.model';
import { BreakoutFiveMinuteTwentyMaComboSignal,
        BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal } from '../signals-combo';

export class QuoteMonoRunner {
    private quoteStats: QuoteStatistics;

    public quoteIntervals: IQuoteFullIntervalData[] = [];

    private signals: SignalModel[] = [];

    private bullishHODSignal!: BullishHODSignal;
    private bullishLevelBreakSignal!: BullishLevelBreakSignal;
    private bullishVolumeSignal!: BullishVolumeSignal;
    private movingAveragesSignal!: MovingAveragesSignal;
    private movingAverageDailyTwentySignal!: MovingAverageDailyTwentySignal;
    private movingAverageDailyFiftySignal!:MovingAverageDailyFiftySignal;
    private movingAveragesHourlyBullish!:MovingAveragesHourlyBullish;
    private movingAveragesFiftyHourlyBullish!:MovingAveragesFiftyHourlyBullish;
    private bullishBuildingAboveTwentyMA!:BullishBuildingAboveTwentyMA;
    private bullishMoveSequenceSignal!:BullishMoveSequenceSignal

    private breakoutFiveMinuteTwentyMaComboSignal!:BreakoutFiveMinuteTwentyMaComboSignal;
    private breakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal!:BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal;

    constructor(quote: string, todayDate: string = '') {
        this.quoteStats = new QuoteStatistics(quote, todayDate);
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata) {
        this.quoteStats.registerMetadata(quoteMetadata);

        quoteState.addNewQuote(this.quoteStats);

        //quoteIntervals = quoteUtils.cleanPreMarketIntervals(quoteIntervals, marketHours);
        this.bullishMoveSequenceSignal = new BullishMoveSequenceSignal(this.quoteStats);
        this.bullishHODSignal = new BullishHODSignal(this.quoteStats);
        this.bullishLevelBreakSignal = new BullishLevelBreakSignal(this.quoteStats);
        this.bullishVolumeSignal = new BullishVolumeSignal(this.quoteStats);
        this.movingAveragesSignal = new MovingAveragesSignal(this.quoteStats);
        this.movingAverageDailyTwentySignal =  new MovingAverageDailyTwentySignal(this.quoteStats);
        this.movingAverageDailyFiftySignal =new MovingAverageDailyFiftySignal(this.quoteStats);
        this.movingAveragesHourlyBullish = new MovingAveragesHourlyBullish(this.quoteStats);
        this.movingAveragesFiftyHourlyBullish = new MovingAveragesFiftyHourlyBullish(this.quoteStats);
        this.bullishBuildingAboveTwentyMA = new BullishBuildingAboveTwentyMA(this.quoteStats);
        
        
        this.breakoutFiveMinuteTwentyMaComboSignal = new BreakoutFiveMinuteTwentyMaComboSignal(this.quoteStats);
        this.breakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal = new BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal(this.quoteStats);

        Object.keys(quoteIntervals).forEach((key) => {
            this.recordNewStockInterval(quoteIntervals[key]);
        });
    }

    //this method is tipically running for one interval unless there is connection/power outage
    public recordQuoteIntervalsIncludingMissed(quoteIntervals: IQuoteIntervals, isLive: boolean = false) {
        let timeDiff = 5;
        const quoteInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
        if(this.quoteStats?.lastInterval?.timeNewYork && quoteInterval?.timeNewYork ) {
            timeDiff =generalUtils.minuteDifference(quoteInterval.timeNewYork,this.quoteStats.lastInterval.timeNewYork);
        }
        for (let i=(timeDiff/5);i>0;i--) {
            const interval = quoteIntervals[Object.keys(quoteIntervals)[Object.keys(quoteIntervals).length-i]];
            if (interval && new Date(interval.timeNewYork)>new Date(this.quoteStats.lastInterval.timeNewYork)) {
                this.recordNewStockInterval(interval,isLive);
            }
            
        }
    }
    
    public recordNewStockInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false): number {
        this.quoteStats.addNewInterval(quoteInterval, isLive);
        this.quoteStats.composeAndPrintCurrentIntervalStats(quoteInterval, isLive);

        this.signals = [
            ...this.bullishMoveSequenceSignal.monitor(),
            ...this.bullishHODSignal.monitor(),
            ...this.bullishLevelBreakSignal.monitor(),
            ...this.bullishVolumeSignal.monitor(),
            ...this.movingAverageDailyTwentySignal.monitor(),
            ...this.movingAverageDailyFiftySignal.monitor(),
            ...this.movingAveragesHourlyBullish.monitor(),
            ...this.movingAveragesFiftyHourlyBullish.monitor(),
            
            // // ...this.movingAveragesSignal.monitor(),
            //...this.bullishBuildingAboveTwentyMA.monitor(),

        ];

        this.signals=this.breakoutFiveMinuteTwentyMaComboSignal.monitor(this.signals);
        this.signals=this.breakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal.monitor(this.signals)

        if (this.signals.length > 0) {
            quoteState.updateSignals(this.quoteStats.quoteName, this.signals,isLive);
            this.signals.forEach((signal) => {
                logger.info(signal.signalDescription);
            });
        }

        return 0;
    }
}
