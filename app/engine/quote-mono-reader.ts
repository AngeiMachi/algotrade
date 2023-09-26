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
         BullishMoveSequenceSignal,
         BearishMoveSequenceSignal,
         BearishLODSignal,
         DailyTwentyMovingAverageBreakSignal,
         BullishDeepSignal
            } 
         from '../signals';
import { QuoteStatistics } from './quote-statistics';
import { SignalModel } from '../models/signal.model';
import { BreakoutFiveMinuteTwentyMaComboSignal,
        BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal,
        BreakoutAfterTouchTenDailyMAComboSignal,
        BullishMoveSequenceComboSignal,
        HammerComboSignal
        } from '../signals-combo';

export class QuoteMonoRunner {
    private quoteStats: QuoteStatistics;

    public quoteIntervals: IQuoteFullIntervalData[] = [];

    private signals: SignalModel[] = [];

    private bullishHODSignal!: BullishHODSignal;
    private bearishLODSignal!: BearishLODSignal;
    private bullishLevelBreakSignal!: BullishLevelBreakSignal;
    private bullishVolumeSignal!: BullishVolumeSignal;
    private movingAveragesSignal!: MovingAveragesSignal;
    private movingAverageDailyTwentySignal!: MovingAverageDailyTwentySignal;
    private movingAverageDailyFiftySignal!:MovingAverageDailyFiftySignal;
    private movingAveragesHourlyBullish!:MovingAveragesHourlyBullish;
    private movingAveragesFiftyHourlyBullish!:MovingAveragesFiftyHourlyBullish;
    private bullishBuildingAboveTwentyMA!:BullishBuildingAboveTwentyMA;
    private bullishMoveSequenceSignal!:BullishMoveSequenceSignal;
    private bearishMoveSequenceSignal!:BearishMoveSequenceSignal;

    private breakoutFiveMinuteTwentyMaComboSignal!:BreakoutFiveMinuteTwentyMaComboSignal;
    private breakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal!:BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal;
    private breakoutAfterTouchTenDailyMAComboSignal!:BreakoutAfterTouchTenDailyMAComboSignal;
    private bullishMoveSequenceComboSignal!:BullishMoveSequenceComboSignal;
    private hammerComboSignal!:HammerComboSignal;
    private dailyTwentyMovingAverageBreakSignal!:DailyTwentyMovingAverageBreakSignal;
    private bullishDeepSignal!:BullishDeepSignal;
    

    constructor(quote: string, todayDate: string = '') {
        this.quoteStats = new QuoteStatistics(quote, todayDate);
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata) {
        this.quoteStats.registerMetadata(quoteMetadata);

        quoteState.addNewQuote(this.quoteStats);

        //quoteIntervals = quoteUtils.cleanPreMarketIntervals(quoteIntervals, marketHours);
        this.bearishMoveSequenceSignal = new BearishMoveSequenceSignal(this.quoteStats);
        this.bullishMoveSequenceSignal = new BullishMoveSequenceSignal(this.quoteStats);
        this.bullishHODSignal = new BullishHODSignal(this.quoteStats);
        this.bearishLODSignal =  new BearishLODSignal(this.quoteStats);


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
        this.breakoutAfterTouchTenDailyMAComboSignal = new BreakoutAfterTouchTenDailyMAComboSignal(this.quoteStats);
        this.bullishMoveSequenceComboSignal = new BullishMoveSequenceComboSignal(this.quoteStats);
        this.hammerComboSignal =  new HammerComboSignal(this.quoteStats);
        this.dailyTwentyMovingAverageBreakSignal = new DailyTwentyMovingAverageBreakSignal(this.quoteStats);
        this.bullishDeepSignal = new BullishDeepSignal(this.quoteStats);

        Object.keys(quoteIntervals).forEach((key) => {
            this.recordNewStockInterval(quoteIntervals[key]);
        });
    }

    //this method is tipically running for one interval unless there is connection/power outage
    public recordQuoteIntervalsIncludingMissed2(quoteIntervals: IQuoteIntervals, isLive: boolean = false) {
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

    public recordQuoteIntervalsIncludingMissed(quoteIntervals: IQuoteIntervals, isLive: boolean = false) {
        let shouldStartRecord = false;
        let shouldIterateMoreThanOnce = true;

        const quoteInterval: IQuoteFullIntervalData = quoteUtils.getRecentIntervalData(quoteIntervals);
        if(this.quoteStats?.lastInterval?.timeNewYork && quoteInterval?.timeNewYork ) {
            const timeDiff =generalUtils.minuteDifference(quoteInterval.timeNewYork,this.quoteStats.lastInterval.timeNewYork);
            this.recordNewStockInterval(quoteInterval,isLive);
            shouldIterateMoreThanOnce = timeDiff>5;   
        } 
        if (shouldIterateMoreThanOnce) {
            for (const [key, interval] of Object.entries(quoteIntervals)) {
                if (shouldStartRecord) {
                    this.recordNewStockInterval(interval,isLive);
                }
    
                if (!this.quoteStats?.lastInterval?.timeNewYork) {
                    shouldStartRecord = true;
                } else if (new Date(interval.timeNewYork)>new Date(this.quoteStats.lastInterval.timeNewYork)) {
                    continue;
                } else if (new Date(interval.timeNewYork)<new Date(this.quoteStats.lastInterval.timeNewYork)) {
                    continue;
                } else {
                    // are equal
                    shouldStartRecord = true;
                } 
            }
        }
        
    }
    
    public recordNewStockInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false): number {
        this.quoteStats.addNewInterval(quoteInterval, isLive);
        this.quoteStats.composeAndPrintCurrentIntervalStats(quoteInterval, isLive);

        this.signals = [
            // ...this.bearishMoveSequenceSignal.monitor(),
            //...this.bullishMoveSequenceSignal.monitor(),
            // ...this.bullishHODSignal.monitor(),
            // ...this.bearishLODSignal.monitor(),
            // ...this.bullishLevelBreakSignal.monitor(),
            // ...this.bullishVolumeSignal.monitor(),
            // ...this.movingAverageDailyTwentySignal.monitor(),
            // ...this.movingAverageDailyFiftySignal.monitor(),
            // ...this.movingAveragesHourlyBullish.monitor(),
            // ...this.movingAveragesFiftyHourlyBullish.monitor(),
            // ...this.movingAveragesSignal.monitor(),
            // ...this.dailyTwentyMovingAverageBreakSignal.monitor(),
            ...this.bullishDeepSignal.monitor(),
            //...this.bullishBuildingAboveTwentyMA.monitor(),

        ];

        this.signals=this.breakoutFiveMinuteTwentyMaComboSignal.monitor(this.signals);
        this.signals=this.breakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal.monitor(this.signals);
        this.signals=this.breakoutAfterTouchTenDailyMAComboSignal.monitor(this.signals);
        this.signals=this.bullishMoveSequenceComboSignal.monitor(this.signals);
        //this.signals=this.hammerComboSignal.monitor(this.signals);
        
        if (this.signals.length > 0) {
            quoteState.updateSignals(this.quoteStats.quoteName, this.signals,isLive);
            this.signals.forEach((signal) => {
                logger.info(signal.signalDescription);
            });
        }

        return 0;
    }
}
