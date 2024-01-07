import { QuoteStatistics } from '../engine/quote-statistics';
import { MovingAverageType } from './enums';
import { SignalModel, TacticalDirectionChangeSignalInput } from './signal.model';

export interface QuoteStateSignals {
    id: number;
    signalDetails: SignalModel;
    interval: number;
    price: number;
    timeNY: string;
    timeIL: string;
}

export interface QuoteState {
    quoteStatistics: QuoteStatistics;
    quotePrice: number;
    metadata: {
        prevPrice: number;
    };
    quoteName: string;
    signalsHistory: QuoteStateSignals[];
    sma: IMovingAverageData[];
    initiatedSignals:{
        tacticalDirectionChangeSignalInput:TacticalDirectionChangeSignalInput[];
    }
}

export interface IMovingAverageData {
    type: MovingAverageType | string;
    isAbove: boolean;
    isTrendingUp: boolean;
}

export interface QuotesState {
    [key: string]: QuoteState;
}
