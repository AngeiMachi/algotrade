import { SignalVerificationReasonEnum } from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { QuoteState } from '../models/state.model';
import * as quoteState from '../engine/state';

export abstract class Signals {
    protected quoteStats: QuoteStatistics;
    protected quoteState:QuoteState;

    constructor(_quoteStats: QuoteStatistics, todayDate: string = '') {
        this.quoteStats = _quoteStats;
        this.quoteState = quoteState.getQuoteStateByName(_quoteStats.quoteName);
    }

    public abstract monitor(): SignalModel[];

    protected saveSignals() {

    }
}
