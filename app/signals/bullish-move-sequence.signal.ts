import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';

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
        if (this.quoteStats.intervalCount === 0) { 
            const min5MA20 = this.quoteStats.lastInterval.MA20 || 10000;
            const min5MA50 = this.quoteStats.lastInterval.MA50 || 0;

            if (this.quoteStats.metadata.SMA10.didOpenOboveSMA &&
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

        if (this.quoteStats.intervalCount < 3) {
            if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.preMarketMetadata.preMarketHOD.high &&
                this.quoteStats.lastInterval.close>this.quoteStats.lastInterval.open &&
                this.isValidForSignal &&
                !this.didSignalTriggered) {
                
                this.didSignalTriggered = true;
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_HOD,
                    signalType: SignalType.BULLISH_SEQUENCE_MOVE,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_SEQUENCE_MOVE,
                    withNotification:true,
                })
            }
        } 
        
            
        return signals;
    }
}