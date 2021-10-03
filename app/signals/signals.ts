import { SignalVerificationReasonEnum } from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';

export abstract class Signals {
    protected quoteStats: QuoteStatistics;

    constructor(_quoteStats: QuoteStatistics, todayDate: string = '') {
        this.quoteStats = _quoteStats;
    }

    public abstract monitor(): SignalModel[];
}
