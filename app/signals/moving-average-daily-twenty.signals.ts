import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from './signals';
import _ from 'lodash';
import { SignalModel } from '../models/signal.model';

const MINIMUM_ONE_SIDE_INTERVALS =7;

export class MovingAverageDailyTwentySignal extends Signals {

    private isAboveDailyTwentyMovingAverage:boolean = false;
    private intervalCount = 0 ;
    private twentyMovingAvgBreakTimesCount:number=0;

    public monitor(): SignalModel[] {
        const signals: SignalModel[] = [];

        const MA20=  this.quoteStats.lastInterval.MA20 || 0;
        if (MA20!==0) {
            if (this.quoteStats.lastInterval.open<MA20 && this.quoteStats.lastInterval.close>MA20) {
                if (this.intervalCount>MINIMUM_ONE_SIDE_INTERVALS && !this.isAboveDailyTwentyMovingAverage) {
                        //Signal Broke up
                        this.twentyMovingAvgBreakTimesCount++;
                        signals.push({
                            signalGroupType: SignalGroupType.INTRADAY_MOVING_AVERAGE,
                            signalType: SignalType.MOVING_AVERAGE_INTRADAY_TWENTY_BREAK_ABOVE,
                            signalDescription: SignalVerificationReasonEnum.MOVING_AVERAGE_INTRADAY_TWENTY_BREAK_ABOVE +"("
                            +this.twentyMovingAvgBreakTimesCount+")"
                        });
                }
                else {
                    this.isAboveDailyTwentyMovingAverage = true;
                }
                this.intervalCount=0;
            }
            else if (this.quoteStats.lastInterval.open>MA20 && this.quoteStats.lastInterval.close<MA20) {
                if (this.intervalCount>MINIMUM_ONE_SIDE_INTERVALS && this.isAboveDailyTwentyMovingAverage) {
                        //Signal Broke dowm
                } else {
                    this.isAboveDailyTwentyMovingAverage = false;
                }
                this.intervalCount=0;
            }
            else if (this.quoteStats.lastInterval.open<MA20 && this.quoteStats.lastInterval.close<MA20) {
                if (!this.isAboveDailyTwentyMovingAverage) {
                    this.intervalCount++;   
                }
            }
            else if (this.quoteStats.lastInterval.open>MA20 && this.quoteStats.lastInterval.close>MA20) {
                if (this.isAboveDailyTwentyMovingAverage) {
                    this.intervalCount++;
                }
            }
         
        }
       
        return signals;
    }
}