import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import { Signals } from './signals';

export class BullishHODSignal extends Signals {
    private preHOD: number;
    private didBreakOutPreHOD: boolean = false;
    private didMakeHigherLow: boolean = false;

    private lastHODInterval = {} as IQuoteFullIntervalData;
    private lastHODIntervalCount: number = 0;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
        this.preHOD = this.quoteStats.metadata.preMarketMetadata?.preMarketHOD.high || 100000;
    }

    public monitor(): SignalModel[] {
        return this.monitorHOD();
    }

    private monitorHOD(): SignalModel[] {
        const signals: SignalModel[] = [];
        if (this.quoteStats.intervalCount === 0) {
            this.lastHODInterval = this.quoteStats.lastInterval;
            this.lastHODIntervalCount = 0;
        } else if (this.quoteStats.lastInterval.close > this.lastHODInterval.high) {
            if (this.quoteStats.intervalCount - this.lastHODIntervalCount >= 2 && this.didMakeHigherLow) {
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_HOD,
                    signalType: SignalType.BULLISH_HIGH_OF_DAY,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_HIGH_OF_DAY,
                });
                this.didMakeHigherLow = false;
            }
            this.lastHODInterval = { ...this.quoteStats.lastInterval };
            this.lastHODIntervalCount = this.quoteStats.intervalCount;
        } else if (this.quoteStats.lastInterval.high > this.lastHODInterval.high && this.quoteStats.intervalCount - this.lastHODIntervalCount <= 2) {
            this.lastHODInterval = this.quoteStats.lastInterval;
            this.didMakeHigherLow = false;
        } else if (this.quoteStats.lastInterval.close < this.quoteStats.lastInterval.open && this.quoteStats.lastInterval.close < this.lastHODInterval.close) {
            this.didMakeHigherLow = true;
        }

        if (this.quoteStats.lastInterval.close > this.preHOD && !this.didBreakOutPreHOD && this.quoteStats.intervalCount > 2) {
            this.didBreakOutPreHOD = true;
            signals.push({
                signalGroupType: SignalGroupType.BULLISH_HOD,
                signalType: SignalType.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT,
                signalDescription: SignalVerificationReasonEnum.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT,
            });
        }
        return signals;
    }
}
