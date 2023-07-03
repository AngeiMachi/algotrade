var moment = require('moment');
var momentDurationFormatSetup = require('moment-duration-format');
momentDurationFormatSetup(moment);

import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import { Signals } from './signals';
import * as generalUtils from '../utils/general'; 

export class BearishLODSignal extends Signals {
    private preLOD: number=100000;
    private didBreakOutPreLOD: boolean = false;
    private didMakeLowerHigh: boolean = false;
    private didMakeFirstCandleLowerHigh:boolean = false;
    private didTouch10MA: boolean = false;
    private didGoAboveLOD: boolean = false;
    
    private lastLODInterval = {} as IQuoteFullIntervalData;
    private lastLODIntervalCount: number = 0;
    private LODSignalCount: number = 1;
    private greenCandlesCount:number = 0;

    private initialInterval= {} as IQuoteFullIntervalData;
    

    constructor(_quoteStats: QuoteStatistics,_initialInterval?:IQuoteFullIntervalData) {
        super(_quoteStats);
        if (_initialInterval) {
            this.initialInterval = _initialInterval;
        }
    }

    public monitor(): SignalModel[] {
        return this.monitorLOD();
    }

    private monitorLOD(): SignalModel[] {
        const signals: SignalModel[] = [];
        if (this.quoteStats.intervalCount === 0) {
            this.preLOD = this.quoteStats.metadata.preMarketMetadata?.preMarketLOD.low || 100000;
            this.lastLODInterval = this.quoteStats.lastInterval;
            this.lastLODIntervalCount = 0;
            if (this.quoteStats.lastInterval.close>this.quoteStats.lastInterval.open) {
                this.greenCandlesCount++;
                this.didMakeFirstCandleLowerHigh = true;
            }
        } else if(this.initialInterval?.intervalNumber==this.quoteStats.intervalCount) {
            this.lastLODInterval = this.quoteStats.lastInterval;
            this.lastLODIntervalCount = this.quoteStats.intervalCount;
        } else if (this.quoteStats.lastInterval.close < this.lastLODInterval.low) {
            if (!this.didBreakOutPreLOD && ((this.didMakeLowerHigh || (this.didMakeFirstCandleLowerHigh && this.quoteStats.intervalCount>=2) ) ||this.LODSignalCount==2) && this.quoteStats.lastInterval.close < this.preLOD  ) {
                    signals.push({
                        signalGroupType: SignalGroupType.BREARISH_LOD,
                        signalType: SignalType.BEARISH_LOW_OF_DAY_WITH_PREMARKET_BREAKOUT,
                        signalDescription: SignalVerificationReasonEnum.BEARISH_LOW_OF_DAY_WITH_PREMARKET_BREAKOUT,
                        interval:this.quoteStats.lastInterval,
                        withNotification:true,
                    });
                    this.didBreakOutPreLOD = true;
                }
            else if ( (this.didMakeLowerHigh ||  (this.didMakeFirstCandleLowerHigh && this.quoteStats.intervalCount>=2)) && this.LODSignalCount==1) {
                signals.push({
                    signalGroupType: SignalGroupType.BREARISH_LOD,
                    signalType: SignalType.BEARLISH_LOW_OF_DAY,
                    signalDescription: SignalVerificationReasonEnum.BEARLISH_LOW_OF_DAY + ' (' + this.getDurationText() + ') - #' + this.LODSignalCount++,
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                });
            }
            this.didMakeFirstCandleLowerHigh = false;
            this.didMakeLowerHigh = false;
            this.lastLODInterval = { ...this.quoteStats.lastInterval };
            this.lastLODIntervalCount = this.quoteStats.intervalCount;
            
        } else if (this.quoteStats.lastInterval.low < this.lastLODInterval.low ) {
            this.lastLODInterval = this.quoteStats.lastInterval;
        } else if (!this.didMakeLowerHigh){
            if (!this.didTouch10MA && (this.quoteStats.lastInterval.high>(this.quoteStats.lastInterval.MA10 || 10000))) {
                this.didTouch10MA = true;
            }
            if (!this.didGoAboveLOD && (this.quoteStats.lastInterval.high> this.lastLODInterval.high)) {
                this.didGoAboveLOD = true;
            }
            if (this.quoteStats.lastInterval.close > this.quoteStats.lastInterval.open && this.quoteStats.lastInterval.close > this.lastLODInterval.close) {
                this.greenCandlesCount++;
            }

            if (this.greenCandlesCount>=2 && this.didTouch10MA) {
                this.didMakeLowerHigh = true;
                this.didTouch10MA=false;
                this.greenCandlesCount=0;
            }
        }

        return signals;
    }

    private getDurationText(): string {
        let text: string = moment.duration((this.quoteStats.intervalCount - this.lastLODIntervalCount) * 5, 'minutes').format('H:mm');
        return text.includes(':') ? text : text + 'min';
    }
}
