import { SignalModel } from '../models/signal.model';
import { Signals } from "../signals/signals";
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { MADirectionEnum, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import * as state from '../engine/state';

export class PotentialBreakoutAfterHourlyTouch extends Signals {

    
    private signals:SignalModel[]=[];
    private bullishHODSignal!: BullishHODSignal | null;
    private intervalFiveMinuteTwentyMA={} as IQuoteFullIntervalData;
    private validateDidTouchHourlyMa:boolean=false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];

        
       for(let signal of _signals) {
            if (signal.signalType===SignalType.HOURLY_MOVING_AVERAGE_TOUCH_FROM_ABOVE) {
                this.validateDidTouchHourlyMa = true;
                if (this.getBullishIndicator().includes('⭐')) {
                    state.updateTacticalDirectionSignal(this.quoteStats.quoteName,"SOFT",MADirectionEnum.UP,SignalVerificationReasonEnum.MOVING_AVERAGE_TOUCH_FROM_ABOVE,false);
                };
                break;
            }
       }
        
       return outputSignals;
    }
}