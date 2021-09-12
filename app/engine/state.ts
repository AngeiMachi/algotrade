import { logger } from '../config/winston.config';

import { SignalVerificationReasonEnum } from '../models/enums';
import { QuotesState, SingleQuoteState, QuoteStateSignals } from '../models/state.model';
import { QuoteStatistics } from './quote-statistics';

const state = {} as QuotesState;

function initQuote(quoteName: string) {
    state[quoteName] = {} as SingleQuoteState;
    state[quoteName].quoteStats = {} as QuoteStatistics;
    state[quoteName].signalsHistory = [];
    state[quoteName].signalsLast = [];
}

export function addNewQuote(quoteStats: QuoteStatistics) {
    if (!state[quoteStats.quoteName]) {
        initQuote(quoteStats.quoteName);
        state[quoteStats.quoteName].quoteStats = quoteStats;
    }
}

export function updateSignals(quoteName: string, signals: SignalVerificationReasonEnum[]) {
    try {
        if (state[quoteName]?.signalsLast[0]?.interval === state[quoteName].quoteStats.intervalCount) {
            throw 'duplication in signals for the same quote';
        } else {
            const quoteStateSignals: QuoteStateSignals[] = [];
            for (let signal of signals) {
                quoteStateSignals.push({ signalType: signal, interval: state[quoteName].quoteStats.intervalCount });
            }

            state[quoteName].signalsHistory = [...state[quoteName].signalsHistory, ...state[quoteName].signalsLast];
            state[quoteName].signalsLast = quoteStateSignals;
        }
    } catch (err) {
        logger.error('error at state.updateSignals - quote=' + quoteName + ',err=' + err);
    }
}
