var moment = require('moment');
var momentDurationFormatSetup = require('moment-duration-format');
momentDurationFormatSetup(moment);

import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import { Signals } from './signals';
import * as generalUtils from '../utils/general'; 

export class BullishHODSignal extends Signals {
    private preHOD: number=100000;
    private didBreakOutPreHOD: boolean = false;
    private didMakeHigherLow: boolean = false;

    private lastHODInterval = {} as IQuoteFullIntervalData;
    private lastHODIntervalCount: number = 0;
    private HODSignalCount: number = 1;
    private redCandlesCount:number = 0;

    private initialInterval= {} as IQuoteFullIntervalData;
    

    constructor(_quoteStats: QuoteStatistics,_initialInterval?:IQuoteFullIntervalData) {
        super(_quoteStats);
        if (_initialInterval) {
            this.initialInterval = _initialInterval;
        }
    }

    public monitor(): SignalModel[] {
        return this.monitorHOD();
    }

    private monitorHOD(): SignalModel[] {
        const signals: SignalModel[] = [];
        if (this.quoteStats.intervalCount === 0) {
            this.preHOD = this.quoteStats.metadata.preMarketMetadata?.preMarketHOD.high || 100000;
            this.lastHODInterval = this.quoteStats.lastInterval;
            this.lastHODIntervalCount = 0;
        } else if(this.initialInterval?.intervalNumber==this.quoteStats.intervalCount) {
            this.lastHODInterval = this.quoteStats.lastInterval;
            this.lastHODIntervalCount = this.quoteStats.intervalCount;
        } else if (this.quoteStats.lastInterval.close > this.lastHODInterval.high) {
            if (this.quoteStats.intervalCount - this.lastHODIntervalCount >= 2 && this.didMakeHigherLow && this.HODSignalCount==1) {
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_HOD,
                    signalType: SignalType.BULLISH_HIGH_OF_DAY,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_HIGH_OF_DAY + ' (' + this.getDurationText() + ') - #' + this.HODSignalCount++,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                });
                this.didMakeHigherLow = false;
            }
            this.lastHODInterval = { ...this.quoteStats.lastInterval };
            this.lastHODIntervalCount = this.quoteStats.intervalCount;
        } else if (this.quoteStats.lastInterval.high > this.lastHODInterval.high && this.quoteStats.intervalCount - this.lastHODIntervalCount <= 2) {
            this.lastHODInterval = this.quoteStats.lastInterval;
            this.didMakeHigherLow = false;
        } else if (this.quoteStats.lastInterval.close < this.quoteStats.lastInterval.open && this.quoteStats.lastInterval.close < this.lastHODInterval.close) {
            this.redCandlesCount++;
            if (this.redCandlesCount==2) {
                this.didMakeHigherLow = true;
                this.redCandlesCount=0;
            }
            
        }

        if (this.quoteStats.lastInterval.close > this.preHOD && !this.didBreakOutPreHOD && this.quoteStats.intervalCount > 2) {
            this.didBreakOutPreHOD = true;
            signals.push({
                signalGroupType: SignalGroupType.BULLISH_HOD,
                signalType: SignalType.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT,
                signalDescription: SignalVerificationReasonEnum.BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT,
                interval:this.quoteStats.lastInterval,
                withNotification:true,
            });
        }
        return signals;
    }

    private getDurationText(): string {
        let text: string = moment.duration((this.quoteStats.intervalCount - this.lastHODIntervalCount) * 5, 'minutes').format('H:mm');
        return text.includes(':') ? text : text + 'min';
    }
}
