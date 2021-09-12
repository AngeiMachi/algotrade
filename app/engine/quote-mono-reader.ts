import moment from 'moment-timezone';
import * as _ from 'lodash';

import * as quoteUtiles from '../utils/quote-utils';
import * as quoteState from './state';

import { IMarketHours, IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';
import { SignalVerificationReasonEnum } from '../models/enums';
import { logger } from '../config/winston.config';
import { BullishHODSignal, BullishLevelBreakSignal } from '../signals';
import { QuoteStatistics } from './quote-statistics';

export class QuoteMonoRunner {
    private quoteStats: QuoteStatistics;

    public quoteIntervals: IQuoteFullIntervalData[] = [];

    private signals: SignalVerificationReasonEnum[] = [];

    private bullishHODSignal!: BullishHODSignal;
    private bullishLevelBreakSignal!: BullishLevelBreakSignal;

    constructor(quote: string, todayDate: string = '') {
        this.quoteStats = new QuoteStatistics(quote, todayDate);
        quoteState.addNewQuote(this.quoteStats);
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata, marketHours: IMarketHours) {
        this.quoteStats.registerMetadata(quoteMetadata);

        quoteIntervals = quoteUtiles.cleanPreMarketIntervals(quoteIntervals, marketHours);
        //this.quoteStats.initializeStockIntervalsSoFar(quoteIntervals);

        this.bullishHODSignal = new BullishHODSignal(this.quoteStats);
        this.bullishLevelBreakSignal = new BullishLevelBreakSignal(this.quoteStats);

        Object.keys(quoteIntervals).forEach((key) => {
            this.recordNewStockInterval(quoteIntervals[key]);
        });
    }

    public recordNewStockInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false): number {
        this.quoteStats.addNewInterval(quoteInterval, isLive);
        this.quoteStats.composeAndPrintCurrentIntervalStats(quoteInterval, isLive);

        //...this.bullishHODSignal.monitor(),
        this.signals = [...this.bullishHODSignal.monitor(), ...this.bullishLevelBreakSignal.monitor()];

        if (this.signals.length > 0) {
            quoteState.updateSignals(this.quoteStats.quoteName, this.signals);
            this.signals.forEach((signal) => {
                logger.info(signal);
            });
        }

        return 0;
    }
}
