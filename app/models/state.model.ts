import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalVerificationReasonEnum } from './enums';

export interface QuoteStateSignals {
    signalType: SignalVerificationReasonEnum;
    interval: number;
}

export interface SingleQuoteState {
    quoteStats: QuoteStatistics;
    signalsHistory: QuoteStateSignals[];
    signalsLast: QuoteStateSignals[];
}

export interface QuotesState {
    [key: string]: SingleQuoteState;
}
