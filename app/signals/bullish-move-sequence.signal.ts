import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import * as generalUtils from '../utils/general';

export class BullishMoveSequenceSignal extends Signals {

    private isValidForSignal:boolean=false;
    private didSignalTriggered:boolean=false;
    private didTouch10MA:boolean = false;
    private didTouch20MA:boolean = false;
    private didBreakPreviousDay:boolean = false;
    private didOpenObovePreviousDay:boolean = false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats)
    }
    monitor(): SignalModel[] { 
        const signals: SignalModel[] = [];
        if (this.quoteStats.intervalCount>=0 && this.quoteStats.intervalCount<4 && !this.didSignalTriggered) {
        
            this.verifyDidOpenObovePreviousDay();
            this.verifyDidTouch10MA();
            this.verifyDidBreakPreviousDay();

        }
        if (this.quoteStats.intervalCount === 0) { 
            const min5MA20 = this.quoteStats.lastInterval.MA20 || 10000;
            const min5MA50 = this.quoteStats.lastInterval.MA50 || 0;
            if ((this.quoteStats.metadata.SMA10.didOpenOboveSMA || ((this.quoteStats.metadata.SMA10.today || 10000)<this.quoteStats.lastInterval.close))&&
                this.quoteStats.metadata.SMA20.didOpenOboveSMA &&
                this.quoteStats.metadata.SMA50.didOpenOboveSMA &&
                this.quoteStats.metadata.SMA100.didOpenOboveSMA &&
                this.quoteStats.metadata.SMA200.didOpenOboveSMA &&
                this.quoteStats.hourlyMA20Last< this.quoteStats.lastInterval.close &&
                this.quoteStats.hourlyMA50Last < this.quoteStats.lastInterval.close && 
                this.quoteStats.lastInterval.open<this.quoteStats.lastInterval.close && 
                min5MA20< this.quoteStats.lastInterval.close && 
                min5MA50< this.quoteStats.lastInterval.close  ){
                    if ((this.quoteStats.lastInterval.open<min5MA20 ||
                        this.quoteStats.lastInterval.open<min5MA50))   {
                        if (Math.abs(this.quoteStats.lastInterval.open-min5MA20)<Math.abs(this.quoteStats.lastInterval.close-min5MA20) &&
                            Math.abs(this.quoteStats.lastInterval.open-min5MA50)<Math.abs(this.quoteStats.lastInterval.close-min5MA20)) {
                                this.isValidForSignal = true;
                        }   
                    } else if (this.quoteStats.lastInterval.open>min5MA20 &&
                               this.quoteStats.lastInterval.open>min5MA50) {
                        this.isValidForSignal = true;
                    }
                }

        }

        if (this.quoteStats.intervalCount < 3 && this.quoteStats.intervalCount >= 0) {
            if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.preMarketMetadata.preMarketHOD.high &&
                this.quoteStats.lastInterval.close>this.quoteStats.lastInterval.open &&
                this.isValidForSignal &&
                !this.didSignalTriggered &&
                (this.didOpenObovePreviousDay || this.didBreakPreviousDay || this.didTouch10MA)) {
                
                this.didSignalTriggered = true;
                signals.push({
                    signalGroupType: SignalGroupType.BEARISH_COMBO,
                    signalType: SignalType.BULLISH_SEQUENCE_MOVE,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_SEQUENCE_MOVE,
                    withNotification:true,
                })
            }
        } 
        
        return signals;
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
        if (this.quoteStats.intervalCount <= 1){
            if (this.quoteStats.quoteIntervals[0].open<this.quoteStats.metadata.previousDay.close) {
                if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.previousDay.high) {
                    const percentangeDistance =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.previousDay.high);
                    if (percentangeDistance>0.3) {
                        this.didBreakPreviousDay = true;
                    }
                }
            }
        }
    }
    
}