
//import { SignalModel } from 'app/models/signal.model';
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType , SignalVerificationReasonEnum} from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { Signals } from '../signals/signals';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import * as generalUtils from '../utils/general';

export class BreakoutFiveMinuteFiftyMaAfterTwentyMaComboSignal extends Signals {
    
    private intervalFiveMinuteTwentyMA={} as IQuoteFullIntervalData;

    private twentyMaCount:number=0;
    private didSignalTriger:boolean = false;
    
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];
        if (!this.didSignalTriger) {
            const intervalFiveMinuteTwentyMASignal = _signals.filter(signal=>signal.signalType===SignalType.MOVING_AVERAGE_INTRADAY_TWENTY_BREAK_ABOVE)[0];
            if (intervalFiveMinuteTwentyMASignal) {
                this.twentyMaCount++;
                this.intervalFiveMinuteTwentyMA = intervalFiveMinuteTwentyMASignal.interval as IQuoteFullIntervalData;
    
            }
            const intervalFiveMinutFiftyMASignal = _signals.filter(signal=>signal.signalType===SignalType.MOVING_AVERAGE_INTRADAY_FIFTY_BREAK_ABOVE)[0];
                    
            const intervalComboSignal = _signals.filter(signal=>signal.signalType===SignalType.BULLISH_NEW_HIGH_BREAKOUT_AFTER_5_MINUTES_TWENTY_MA_CROSSING)[0];
            
            if (intervalFiveMinutFiftyMASignal ) {
                const percentageintervalFiveMinutFiftyMAS = generalUtils.getPercentageDifference (intervalFiveMinutFiftyMASignal.interval?.low || 0,intervalFiveMinutFiftyMASignal.interval?.high || 0);
             if (this.twentyMaCount>=2 && percentageintervalFiveMinutFiftyMAS>0.5) {
                    outputSignals.push({
                        signalGroupType: SignalGroupType.BULLISH_COMBO,
                        signalType: SignalType.BULLISH_FIFTY_5_MINUTES_MA_AFTER_TWO_TWENTY,
                        signalDescription: SignalVerificationReasonEnum.BULLISH_FIFTY_5_MINUTES_MA_AFTER_TWO_TWENTY,
                        interval:this.quoteStats.lastInterval,
                        withNotification:false,
                        isDeveloperMode:true
                    })
                    this.didSignalTriger = true;
                } else if (intervalComboSignal) {
                    const percentageCombo = generalUtils.getPercentageDifference (intervalComboSignal.interval?.low || 0,intervalComboSignal.interval?.high || 0);
                    if (percentageCombo>0.5) {
                        _signals =_signals.filter(signal=>signal.signalType!==SignalType.BULLISH_NEW_HIGH_BREAKOUT_AFTER_5_MINUTES_TWENTY_MA_CROSSING);
                        outputSignals.push({
                            signalGroupType: SignalGroupType.BULLISH_COMBO,
                            signalType: SignalType.BULLISH_FIFTY_5_MINUTES_MA_AFTER_TWENTY_HOD,
                            signalDescription: SignalVerificationReasonEnum.BULLISH_FIFTY_5_MINUTES_MA_AFTER_TWENTY_HOD,
                            interval:this.quoteStats.lastInterval,
                            withNotification:false,
                            isDeveloperMode:true
                        })
                        this.didSignalTriger = true;
                    }
                }
            } 
        }
        return [...outputSignals,..._signals];
    }

}