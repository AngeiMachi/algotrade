import { SignalVerificationReasonEnum } from '../models/enums';
import { QuoteStats } from '../engine/quote-stats';

export abstract class Signals {
    protected quoteStats: QuoteStats;

    constructor(_quoteStats: QuoteStats, todayDate: string = '') {
        this.quoteStats = _quoteStats;
    }

    public abstract monitor(): SignalVerificationReasonEnum[];
}
