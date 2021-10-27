import moment from 'moment-timezone';
import * as _ from 'lodash';
import * as clientService from '../proxy/client-service';
import { logger } from '../config/winston.config';

import { MovingAverageType, SignalVerificationReasonEnum } from '../models/enums';
import { QuotesState, QuoteState, QuoteStateSignals, IMovingAverageData } from '../models/state.model';
import { QuoteStatistics } from './quote-statistics';
import { SignalModel } from '../models/signal.model';

let state: QuoteState[] = [];
let lastIntervalCount = -1;

function initQuote(quoteStatistics: QuoteStatistics) {
    const quoteState = {} as QuoteState;

    quoteState.quoteStatistics = quoteStatistics;
    quoteState.quoteName = quoteStatistics.quoteName;
    quoteState.signalsHistory = [];
    quoteState.metadata = {
        prevPrice: quoteStatistics.metadata.previousDay.close,
    };

    quoteState.sma = initSmaData(quoteStatistics);

    state.push(quoteState);
}

function initSmaData(quoteStatistics: QuoteStatistics) {
    const tempMovingAveragesArr: any[] = [];
    let sma = [] as IMovingAverageData[];
    for (let key in MovingAverageType) {
        if (isNaN(Number(key))) {
            //@ts-ignore
            const detadataSmaRef = quoteStatistics.metadata[key as string] as any;
            if (_.has(detadataSmaRef, 'didOpenOboveSMA') && _.has(detadataSmaRef, 'today') && _.has(detadataSmaRef, 'previousDay')) {
                tempMovingAveragesArr.push({
                    type: MovingAverageType[key],
                    isAbove: detadataSmaRef['didOpenOboveSMA'] as boolean,
                    isTrendingUp: ((detadataSmaRef['today'] - detadataSmaRef['previousDay']) as number) > 0,
                    value: detadataSmaRef.today,
                });
            }
        }
    }

    const sortedMovingAverageg = _.orderBy(tempMovingAveragesArr, ['value'], ['desc']);
    sma = sortedMovingAverageg.map((item) => {
        return {
            type: item.type,
            isAbove: item.isAbove,
            isTrendingUp: item.isTrendingUp,
        };
    });

    return sma;
}

export function addNewQuote(quoteStats: QuoteStatistics) {
    const quoteIndex = _.findIndex(state, ['quoteName', quoteStats.quoteName]);
    if (quoteIndex < 0) {
        initQuote(quoteStats);
    }
}

export function updateSignals(quoteName: string, signals: SignalModel[],isLive:boolean) {
    try {
        const updatedQuote = _.remove(state, { quoteName: quoteName })[0] as QuoteState;
        for (let signal of signals) {
            updatedQuote.signalsHistory.unshift({
                id: updatedQuote.signalsHistory.length,
                signalDetails: signal,
                price: Math.round(updatedQuote.quoteStatistics.lastInterval.close * 10) / 10,
                interval: updatedQuote.quoteStatistics.intervalCount,
                timeNY: moment(updatedQuote.quoteStatistics.lastInterval.timeNewYork).format('HH:mm'),
                timeIL: moment(updatedQuote.quoteStatistics.lastInterval.timeIsrael).format('HH:mm'),
            });
        }
        updatedQuote.quotePrice = updatedQuote.quoteStatistics.lastInterval.close;

        if (updatedQuote.quoteStatistics.intervalCount >= lastIntervalCount) {
            lastIntervalCount = updatedQuote.quoteStatistics.intervalCount;
            state.unshift(updatedQuote);
        } else {
            let didInsert = false;
            for (let i = 0; i < state.length; i++) {
                if (state[i].signalsHistory[0]?.interval <= updatedQuote.quoteStatistics.intervalCount || state[i].signalsHistory.length === 0) {
                    state.splice(i, 0, updatedQuote);
                    didInsert = true;
                    break;
                }
            }
            if (!didInsert) {
                state.push(updatedQuote);
            }
        }

        clientService.updateQuote(updatedQuote,isLive);
    } catch (err) {
        logger.error('error at state.updateSignals - quote=' + quoteName + ',err=' + err);
    }
}

export function getState() {
    const returnedState: any[] = [];
    for (let quote of state) {
        if (quote.signalsHistory.length > 0) {
            returnedState.push(_.omit(quote, ['quoteStatistics']));
        }
    }
    return returnedState;
}
