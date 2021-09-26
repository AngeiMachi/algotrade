import { QuoteStatistics } from '../engine/quote-statistics';
import { MovingAverageType, SignalVerificationReasonEnum } from './enums';

export interface QuoteStateSignals {
    id: number;
    signalType: SignalVerificationReasonEnum;
    interval: number;
    timeNY: string;
    timeIL: string;
}

export interface QuoteState {
    quoteStatistics: QuoteStatistics;
    quoteName: string;
    signalsHistory: QuoteStateSignals[];
    sma: IMovingAverageData[];
}

export interface IMovingAverageData {
    type: MovingAverageType | string;
    isAbove: boolean;
    isTrendingUp: boolean;
}

export interface QuotesState {
    [key: string]: QuoteState;
}
