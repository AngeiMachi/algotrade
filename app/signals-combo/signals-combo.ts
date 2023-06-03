import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from '../signals/signals';

export abstract class SignalsCombo extends Signals {
    
    private recentSignals:SignalModel[]=[];

    constructor(_quoteStats: QuoteStatistics, todayDate: string = '') {
        super(_quoteStats);
    }

    public saveRecentSignals(_signals:SignalModel[]) {
        if (_signals) {
            this.recentSignals=_signals;
        }
    }
}
