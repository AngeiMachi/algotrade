import _ from 'lodash';
import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import * as generalUtils from '../utils/general';
import * as candleUtils from '../utils/candle-utils';

const MINIMUM_PERCENTAGE_DISTANCE_TO_ENABLE_SIGNAL = 4;

export class BearishMoveSequenceSignal extends Signals {

    private isValidForSignal:boolean=false;
    private didSignalTriggered:boolean=false;
    private didTouch10MA:boolean = false;
    private didTouch20MA:boolean = false;
    private didBreakPreviousDay:boolean = false;
    private didOpenBelowPreviousDay:boolean = false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats)
    }
    monitor(): SignalModel[] { 
        const signals: SignalModel[] = [];
        if (this.quoteStats.intervalCount>=0 && this.quoteStats.intervalCount<4 && !this.didSignalTriggered) {
        
            this.verifyDidOpenBelowPreviousDay();
            this.verifyDidTouch10MA();
            this.verifyDidBreakPreviousDay();

        }
        if (this.quoteStats.intervalCount === 0) { 

    
            const min5MA20 = this.quoteStats.lastInterval.MA20 || 0;
            const min5MA50 = this.quoteStats.lastInterval.MA50 || 10000;

            if (this.isMinimumPercentageDifferenceEnabled() &&
                !this.quoteStats.metadata.SMA10.didOpenOboveSMA &&
                !this.quoteStats.metadata.SMA20.didOpenOboveSMA &&
                // this.quoteStats.metadata.SMA50.didOpenOboveSMA &&
                // this.quoteStats.metadata.SMA100.didOpenOboveSMA &&
                // this.quoteStats.metadata.SMA200.didOpenOboveSMA &&
                this.quoteStats.hourlyMA20Last> this.quoteStats.lastInterval.close &&
                this.quoteStats.hourlyMA50Last> this.quoteStats.lastInterval.close && 
                this.quoteStats.lastInterval.open>this.quoteStats.lastInterval.close && 
                min5MA20> this.quoteStats.lastInterval.close && 
                min5MA50> this.quoteStats.lastInterval.close  ){
                    if ((this.quoteStats.lastInterval.open>min5MA20 ||
                        this.quoteStats.lastInterval.open>min5MA50))   {
                        if (Math.abs(this.quoteStats.lastInterval.open-min5MA20)>Math.abs(this.quoteStats.lastInterval.close-min5MA20) &&
                            Math.abs(this.quoteStats.lastInterval.open-min5MA50)>Math.abs(this.quoteStats.lastInterval.close-min5MA20)) {
                                this.isValidForSignal = true;
                        }   
                    } else if (this.quoteStats.lastInterval.open<min5MA20 &&
                               this.quoteStats.lastInterval.open<min5MA50 &&
                               !candleUtils.isHammer(this.quoteStats.lastInterval)) {
                        this.isValidForSignal = true;
                    }
                }

        }

        if (this.quoteStats.intervalCount < 3 && this.quoteStats.intervalCount >= 0) {
            if (this.quoteStats.lastInterval.close<this.quoteStats.metadata.preMarketMetadata.preMarketLOD.low &&
                this.quoteStats.lastInterval.close<this.quoteStats.lastInterval.open &&
                this.isValidForSignal &&
                !this.didSignalTriggered &&
                (this.didOpenBelowPreviousDay || this.didBreakPreviousDay || this.didTouch10MA)) {
                
                this.didSignalTriggered = true;
                signals.push({
                    signalGroupType: SignalGroupType.BEARISH_COMBO,
                    signalType: SignalType.BEARISH_SEQUENCE_MOVE,
                    signalDescription: SignalVerificationReasonEnum.BEARISH_SEQUENCE_MOVE,
                    withNotification:true,
                })
            }
        } 
        
            
        return signals;
    }

    private isMinimumPercentageDifferenceEnabled():boolean {
        const movingAveragesObj = _.pick(this.quoteStats.metadata, ['SMA20', 'SMA50', 'SMA100', 'SMA200']);
        const movingAverages = Object.entries(movingAveragesObj);
        let movingAveragesAboveCount = 0;

        for (let movingAverage of movingAverages) {
            if (movingAverage[1].didOpenOboveSMA) {
                if (generalUtils.getPercentageDifference(this.quoteStats.quoteIntervals[0].close,movingAverage[1].previousDay) < MINIMUM_PERCENTAGE_DISTANCE_TO_ENABLE_SIGNAL) {
                    return false;
                }
                movingAveragesAboveCount++;         
            }
        }
        if (movingAveragesAboveCount==movingAverages.length) {
            return false;
        }
        return true;
    }
    private verifyDidOpenBelowPreviousDay() {
        if (this.quoteStats.intervalCount === 0 ){
            const percentangeDistance = generalUtils.getPercentageDifference(this.quoteStats.metadata.previousDay.low,this.quoteStats.lastInterval.open);
            const percentangeDistanceFrom10MA = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.open);
            const percentangeDistanceFrom20MA = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA20.previousDay,this.quoteStats.lastInterval.open);
        
            if (this.quoteStats.metadata.previousDay.low>this.quoteStats.lastInterval.open && 
                (percentangeDistance>0.5  || percentangeDistance<3) && 
                (percentangeDistanceFrom10MA<5 || percentangeDistanceFrom20MA<5)) {
                this.didOpenBelowPreviousDay = true;
            }
        }
        
    }

    private verifyDidTouch10MA() {
        if (!this.quoteStats.metadata.SMA10.didOpenOboveSMA) {
            const percentangeDistanceFrom10MAtouch = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.low);
            if (percentangeDistanceFrom10MAtouch<2 || this.quoteStats.metadata.SMA10.previousDay<this.quoteStats.lastInterval.high) {
                this.didTouch10MA = true;
            }
        }
    }

    private verifyDidBreakPreviousDay() {
        if (this.quoteStats.intervalCount === 0 ){
            if (this.quoteStats.quoteIntervals[0].open>this.quoteStats.metadata.previousDay.close) {
                if (this.quoteStats.lastInterval.close<this.quoteStats.metadata.previousDay.low) {
                    const percentangeDistance =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.previousDay.high);
                    if (percentangeDistance>0.3) {
                        this.didBreakPreviousDay = true;
                    }
                }
            }
        }
    }
    
}