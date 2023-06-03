
//import { SignalModel } from 'app/models/signal.model';
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType , SignalVerificationReasonEnum} from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { Signals } from '../signals/signals';

import { IQuoteFullIntervalData } from '../models/quote-data.model';


export class BreakoutFiveMinuteTwentyMaComboSignal extends Signals {

    
    private signals:SignalModel[]=[];
    private bullishHODSignal!: BullishHODSignal | null;
    private intervalFiveMinuteTwentyMA={} as IQuoteFullIntervalData;
    
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];

        this.signals=_signals;
        const intervalFiveMinuteTwentyMASignal = _signals.filter(signal=>signal.signalType===SignalType.MOVING_AVERAGE_INTRADAY_TWENTY_BREAK_ABOVE)[0]
        if (intervalFiveMinuteTwentyMASignal) {
            this.intervalFiveMinuteTwentyMA = intervalFiveMinuteTwentyMASignal.interval as IQuoteFullIntervalData;
            this.bullishHODSignal = new BullishHODSignal(this.quoteStats,this.intervalFiveMinuteTwentyMA);
        }
        if (this.bullishHODSignal) {
            const signals = this.bullishHODSignal.monitor();
            if (this.isNewHODFromFiveMinutesBreak(signals)) {
                outputSignals.push({
                    signalGroupType: SignalGroupType.BULLISH_COMBO,
                    signalType: SignalType.BULLISH_NEW_HIGH_BREAKOUT_AFTER_5_MINUTES_TWENTY_MA_CROSSING,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_NEW_HIGH_BREAKOUT_AFTER_5_MINUTES_TWENTY_MA_CROSSING,
                    withNotification:true,
                })
                this.bullishHODSignal = null;
            }
        }
    
        return [...outputSignals,..._signals];
    }

    private isNewHODFromFiveMinutesBreak(signals:SignalModel[]):boolean {
        return (signals.filter(signal=>(signal.signalGroupType===SignalGroupType.BULLISH_HOD && 
            signal.signalType===SignalType.BULLISH_HIGH_OF_DAY))?.length>0)
    }
    
    


}