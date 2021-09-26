import moment from 'moment-timezone';
import * as _ from 'lodash';

import * as quoteUtiles from '../utils/quote-utils';
import * as quoteState from './state';

import { IMarketHours, IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';
import { SignalVerificationReasonEnum } from '../models/enums';
import { logger } from '../config/winston.config';
import { BullishHODSignal, BullishLevelBreakSignal, BullishVolumeSignal } from '../signals';
import { QuoteStatistics } from './quote-statistics';

export class QuoteMonoRunner {
    private quoteStats: QuoteStatistics;

    public quoteIntervals: IQuoteFullIntervalData[] = [];

    private signals: SignalVerificationReasonEnum[] = [];

    private bullishHODSignal!: BullishHODSignal;
    private bullishLevelBreakSignal!: BullishLevelBreakSignal;
    private bullishVolumeSignal!: BullishVolumeSignal;

    constructor(quote: string, todayDate: string = '') {
        this.quoteStats = new QuoteStatistics(quote, todayDate);
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata, marketHours: IMarketHours) {
        this.quoteStats.registerMetadata(quoteMetadata);

        quoteState.addNewQuote(this.quoteStats);

        quoteIntervals = quoteUtiles.cleanPreMarketIntervals(quoteIntervals, marketHours);
        //this.quoteStats.initializeStockIntervalsSoFar(quoteIntervals);

        this.bullishHODSignal = new BullishHODSignal(this.quoteStats);
        this.bullishLevelBreakSignal = new BullishLevelBreakSignal(this.quoteStats);
        this.bullishVolumeSignal = new BullishVolumeSignal(this.quoteStats);

        Object.keys(quoteIntervals).forEach((key) => {
            this.recordNewStockInterval(quoteIntervals[key]);
        });
    }

    public recordNewStockInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false): number {
        this.quoteStats.addNewInterval(quoteInterval, isLive);
        this.quoteStats.composeAndPrintCurrentIntervalStats(quoteInterval, isLive);

        this.signals = [...this.bullishHODSignal.monitor(), ...this.bullishLevelBreakSignal.monitor(), ...this.bullishVolumeSignal.monitor()];

        if (this.signals.length > 0) {
            quoteState.updateSignals(this.quoteStats.quoteName, this.signals);
            this.signals.forEach((signal) => {
                logger.info(signal);
            });
        }

        return 0;
    }
}
