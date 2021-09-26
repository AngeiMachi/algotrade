import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from './signals';
import { SignalVerificationReasonEnum } from '../models/enums';

export class BullishLevelBreakSignal extends Signals {
    private didOpenBelowPreviousDay: boolean = false;
    private didOpenBelowPreviousWeek: boolean = false;
    private didBreakPreviousDayHigh: boolean = false;
    private didBreakPreviousWeekHigh: boolean = false;
    private didOpenBelowFiftyTwoWeekHigh: boolean = false;
    private didBreakFiftyTwoWeekHig: boolean = false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }

    public monitor(): SignalVerificationReasonEnum[] {
        const signals: SignalVerificationReasonEnum[] = [];
        if (this.quoteStats.intervalCount === 0) {
            this.didOpenBelowPreviousDay = this.quoteStats.metadata.previousDay.high > this.quoteStats.lastInterval.open ? true : false;
            this.didOpenBelowPreviousWeek = this.quoteStats.metadata.previousWeek.high > this.quoteStats.lastInterval.open ? true : false;
            this.didOpenBelowFiftyTwoWeekHigh = this.quoteStats.metadata.fiftyTwoWeekHigh > this.quoteStats.lastInterval.open ? true : false;
        } else {
            if (this.didOpenBelowPreviousDay && this.quoteStats.lastInterval.close > this.quoteStats.metadata.previousDay.high && !this.didBreakPreviousDayHigh) {
                this.didBreakPreviousDayHigh = true;
                signals.push(SignalVerificationReasonEnum.BULLISH_BREAK_PREVIOUS_DAY);
            }
            if (this.didOpenBelowPreviousWeek && this.quoteStats.lastInterval.close > this.quoteStats.metadata.previousWeek.high && !this.didBreakPreviousWeekHigh) {
                this.didBreakPreviousWeekHigh = true;
                signals.push(SignalVerificationReasonEnum.BULLISH_BREAK_PREVIOUS_WEEK);
            }
            if (this.didOpenBelowFiftyTwoWeekHigh && this.quoteStats.lastInterval.close > this.quoteStats.metadata.fiftyTwoWeekHigh && !this.didBreakFiftyTwoWeekHig) {
                this.didBreakFiftyTwoWeekHig = true;
                signals.push(SignalVerificationReasonEnum.BULLISH_BREAK_52_WEEK_HIGH);
            }
        }

        return signals;
    }
}
