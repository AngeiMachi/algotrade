
//import { SignalModel } from 'app/models/signal.model';
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType , SignalVerificationReasonEnum} from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { Signals } from '../signals/signals';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import * as generalUtils from '../utils/general';


export class BreakoutAfterTouchTenDailyMAComboSignal extends Signals {

    
    private signals:SignalModel[]=[];
    private bullishHODSignal!: BullishHODSignal | null;
    private intervalFiveMinuteTwentyMA={} as IQuoteFullIntervalData;
    private didTouch10MA:boolean = false;
    private didTouch20MA:boolean = false;
    private didBreakPreviousDay:boolean = false;
    private didOpenObovePreviousDay:boolean = false;
    
    private isMovingAverageTouched:boolean = false;
    private didSignalTriggered:boolean = false;
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];
        this.signals=_signals;

        if (this.quoteStats.intervalCount>=0 && this.quoteStats.intervalCount<2 && !this.didSignalTriggered) {
        
            this.verifyDidOpenObovePreviousDay();
            this.verifyDidTouch10MA();
            
        }

        this.verifyDidBreakPreviousDay();

        const isMovingAverageTouchedSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.MOVING_AVERAGES && signal.signalType===SignalType.MOVING_AVERAGE_TOUCH_FROM_BELOW)[0]
    
        if (isMovingAverageTouchedSignal?.payload?.type =='SMA10' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA20' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA50') {
            this.isMovingAverageTouched=true;
        }

        if ((this.didOpenObovePreviousDay || this.didBreakPreviousDay || this.didTouch10MA) && !this.didSignalTriggered ) {
            const isHODwithPreMarketBreakoutSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.BULLISH_HOD && signal.signalType===SignalType.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT)[0]
            if (isHODwithPreMarketBreakoutSignal) {
                outputSignals.push({
                    signalGroupType: SignalGroupType.BULLISH_COMBO,
                    signalType: SignalType.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_CONDITION_FILLED,
                    signalDescription: SignalVerificationReasonEnum.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_CONDITION_FILLED,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                });
                this.didSignalTriggered=true;
            }
        }
        return [...outputSignals,..._signals];
    }


    private verifyDidOpenObovePreviousDay() {
        if (this.quoteStats.intervalCount === 0 ){
            const percentangeDistance = generalUtils.getPercentageDifference(this.quoteStats.metadata.previousDay.high,this.quoteStats.lastInterval.open);
            const percentangeDistanceFrom10MA = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.open);
    
            if (this.quoteStats.metadata.previousDay.high<this.quoteStats.lastInterval.open && 
                percentangeDistance>0.4 &&
                percentangeDistanceFrom10MA<5) {
                this.didOpenObovePreviousDay = true;
            }
        }
    }

    private verifyDidTouch10MA() {
        if (this.quoteStats.metadata.SMA10.didOpenOboveSMA || 
            ((this.quoteStats.metadata.SMA10?.today || 10000)<this.quoteStats.lastInterval.close && this.quoteStats.intervalCount ===0 )){
            const percentangeDistanceFrom10MAtouch = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.low);
            if (percentangeDistanceFrom10MAtouch<2 || this.quoteStats.metadata.SMA10.previousDay>this.quoteStats.lastInterval.low) {
                this.didTouch10MA = true;
            }
        }
    }

    private verifyDidBreakPreviousDay() {
        if (this.quoteStats.intervalCount >=0){
            if (this.quoteStats.quoteIntervals[0].open<this.quoteStats.metadata.previousDay.high) {
                if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.previousDay.high) {
                    const percentangeDistance =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.previousDay.high);
                    if (percentangeDistance>0.2) {
                        this.didBreakPreviousDay = true;
                    }
                }
            }
        }
    }
    
}