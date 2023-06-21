
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
    
    
    private isMovingAverageTouched:boolean = false;
    private didbreakout:boolean = false;
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];

        this.signals=_signals;
        const isMovingAverageTouchedSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.MOVING_AVERAGES && signal.signalType===SignalType.MOVING_AVERAGE_TOUCH_FROM_BELOW)[0]
    
        if (isMovingAverageTouchedSignal?.payload?.type =='SMA10' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA20' || 
            isMovingAverageTouchedSignal?.payload?.type =='SMA50') {
            this.isMovingAverageTouched=true;
        }

        if (this.isMovingAverageTouched && !this.didbreakout) {
            const isHODwithPreMarketBreakoutSignal = _signals.filter(signal=>signal.signalGroupType===SignalGroupType.BULLISH_HOD && signal.signalType===SignalType.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT)[0]
            if (isHODwithPreMarketBreakoutSignal) {
                outputSignals.push({
                    signalGroupType: SignalGroupType.BULLISH_COMBO,
                    signalType: SignalType.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_TOUCH_MA,
                    signalDescription: SignalVerificationReasonEnum.BULLUSH_HOD_WITH_PREMARKET_BREAKOUT_AFTER_TOUCH_MA,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                });
                this.didbreakout=true;
            }
        }
        return [...outputSignals,..._signals];
    }
}