
import moment from 'moment-timezone';
import { SignalModel } from "../models/signal.model";
import { QuoteStatistics } from "../engine/quote-statistics";
import { Signals } from "./signals";
import * as quoteState from '../engine/state';
import { SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';
import * as generalUtils from '../utils/general';

export class DailyTwentyMovingAverageBreakSignal extends Signals {
    private marketHours:any;
    private isValidForBullishSignal:boolean=false;
    private isValidityChecked:boolean=false;
    private didSignal:boolean=false;
    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
        this.marketHours =quoteState.getMarketHours();
    }

    public monitor(): SignalModel[] {
        const signals: SignalModel[] = [];
        const timediff= moment(this.quoteStats.lastInterval.timeNewYork).diff( this.marketHours.sessionHours.regularMarket.start, 'minutes'); 
        
        if (!this.isValidityChecked) {
            if (this.quoteStats.metadata.previousDay.close<this.quoteStats.metadata.SMA20.previousDay) {
                this.isValidForBullishSignal = true;
            } else if (this.quoteStats.metadata.previousDay.open<this.quoteStats.metadata.SMA20.previousDay &&
                       this.quoteStats.metadata.previousDay.close>=this.quoteStats.metadata.SMA20.previousDay &&
                       this.quoteStats.metadata.dailyHistoricalData[this.quoteStats.metadata.dailyHistoricalData.length-1]?.close<this.quoteStats.metadata.SMA20.previousDay){

                        this.isValidForBullishSignal =true;
            }

            this.isValidityChecked =true;
        }
        if (timediff>-30 && timediff<=0 && this.isValidityChecked && !this.didSignal) {
            if (this.isValidForBullishSignal) {
                const twentyMaDiff =generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.SMA20.previousDay);
                const prevDayDiff =generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.previousDay.close);
                if ((this.quoteStats.lastInterval.close>this.quoteStats.metadata.SMA20.previousDay ||
                    (twentyMaDiff<0.1 && timediff>=-10)) &&
                    (this.quoteStats.lastInterval.close>this.quoteStats.metadata.previousDay.close ||
                    prevDayDiff<0.05)) {
                        this.didSignal =true;
                        signals.push({
                            signalGroupType: SignalGroupType.PRE_OPEN_SIGNAL,
                            signalType: SignalType.BULLISH_TWENTY_MOVING_AVERAGE_BREAK,
                            signalDescription: SignalVerificationReasonEnum.BULLISH_TWENTY_MOVING_AVERAGE_BREAK,
                            withNotification:false,
                        })
                    }
            }
            

        }
        
        return signals;
    }
}