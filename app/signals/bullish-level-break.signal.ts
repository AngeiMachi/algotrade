import { QuoteStats } from '../quote-stats';
import { Signals } from './signals';
import { SignalVerificationReasonEnum } from '../models/enums';

export class BullishLevelBreakSignal extends Signals {
    private didOpenBelowPreviousDay: boolean = false;

    constructor(_quoteStats: QuoteStats) {
        super(_quoteStats);
    }

    public monitor(): SignalVerificationReasonEnum[] {
        if (this.quoteStats.intervalCount === 0) {
            this.didOpenBelowPreviousDay = this.quoteStats.metadata.previousDay.close > this.quoteStats.lastInterval.open ? true : false;
        } else if (this.didOpenBelowPreviousDay) {
            if (this.quoteStats.lastInterval.close > this.quoteStats.metadata.previousDay.high) {
            }
        }
    }
}
