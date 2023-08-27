
import { SignalBullishValidator } from "../signals/signal-bullish-validator";
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType , SignalVerificationReasonEnum} from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { Signals } from '../signals/signals';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import * as generalUtils from '../utils/general';


export class BreakoutAfterTouchTenDailyMAComboSignal extends SignalBullishValidator {


    private isMovingAverageTouched:boolean = false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats,80);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];
        super.monitor(_signals);

        
        const isMovingAverageTouchedSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.MOVING_AVERAGES && signal.signalType===SignalType.MOVING_AVERAGE_TOUCH_FROM_BELOW)[0]
    
        if (isMovingAverageTouchedSignal?.payload?.type =='SMA10' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA20' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA50') {
            this.isMovingAverageTouched=true;
        }

        if ((this.didOpenObovePreviousDay || this.didBreakPreviousDay || this.didTouch10MA || this.isMovingAverageTouched) && !this.didSignalTriggered ) {
            const isHODwithPreMarketBreakoutSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.BULLISH_HOD && signal.signalType===SignalType.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT)[0]
            if (isHODwithPreMarketBreakoutSignal) {
                outputSignals.push({
                    signalGroupType: SignalGroupType.BULLISH_COMBO,
                    signalType: SignalType.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_CONDITION_FILLED,
                    signalDescription: SignalVerificationReasonEnum.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_CONDITION_FILLED +this.signalMetaData,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                });
                this.didSignalTriggered=true;
            }
        }
        return [...outputSignals,..._signals];
    }
    
}