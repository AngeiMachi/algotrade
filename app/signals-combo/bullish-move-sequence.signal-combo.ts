import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalModel } from '../models/signal.model';
import { SignalBullishValidator } from "../signals/signal-bullish-validator";
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';

export class BullishMoveSequenceComboSignal extends SignalBullishValidator {
    private isValidForSignal:boolean =false;
    
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats)
    }

    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[];

        super.monitor(_signals);

        this.validateMovingAveragesOptimality();
        outputSignals =  this.validateSignal();

        return [...outputSignals,..._signals];
    }

    private validateMovingAveragesOptimality() {
        if (this.quoteStats.intervalCount < 3 && this.quoteStats.intervalCount >= 0) { 
            const min5MA20 = this.quoteStats.lastInterval.MA20 || 10000;
            const min5MA50 = this.quoteStats.lastInterval.MA50 || 0;
            if ((this.quoteStats.metadata.SMA10.didOpenOboveSMA || ((this.quoteStats.metadata.SMA10.today || 10000)<this.quoteStats.lastInterval.close))&&
                this.quoteStats.metadata.SMA20.didOpenOboveSMA &&
                (this.quoteStats.metadata.SMA50.didOpenOboveSMA  || ((this.quoteStats.metadata.SMA50.today  || 1000)<this.quoteStats.lastInterval.close)) &&
                (this.quoteStats.metadata.SMA100.didOpenOboveSMA || ((this.quoteStats.metadata.SMA100.today || 1000)<this.quoteStats.lastInterval.close)) &&
                (this.quoteStats.metadata.SMA200.didOpenOboveSMA || ((this.quoteStats.metadata.SMA200.today || 1000)<this.quoteStats.lastInterval.close)) &&
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
    }

    validateSignal() :SignalModel[]{
        let outputSignals:SignalModel[] = [];
        if (this.quoteStats.intervalCount < 3 && this.quoteStats.intervalCount >= 0) {
            if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.preMarketMetadata.preMarketHOD.high &&
                this.quoteStats.lastInterval.close>this.quoteStats.lastInterval.open &&
                this.isValidForSignal &&
                !this.didSignalTriggered &&
                (this.didOpenObovePreviousDay || this.didBreakPreviousDay || this.didTouch10MA)) {
                
                this.didSignalTriggered = true;
                outputSignals.push({
                    signalGroupType: SignalGroupType.BEARISH_COMBO,
                    signalType: SignalType.BULLISH_SEQUENCE_MOVE,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_SEQUENCE_MOVE+this.signalMetaData,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                })
            }
        } 
        return outputSignals;
    }

    
}