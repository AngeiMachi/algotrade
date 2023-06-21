import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from './signals';
import _ from 'lodash';
import { SignalModel } from '../models/signal.model';

const MINIMUM_ONE_SIDE_INTERVALS =3;

export class MovingAverageDailyFiftySignal extends Signals {

    private isAboveDailyFiftyMovingAverage:boolean = false;
    private intervalCount = 0 ;
    private fiftyMovingAvgBreakTimesCount:number=0;

    public monitor(): SignalModel[] {
        let signals: SignalModel[] = [];

        const MA50= this.quoteStats.lastInterval.MA50 || 0;
        if (MA50!==0 && this.quoteStats.intervalCount>0 ) {
            if (this.quoteStats.lastInterval.open<MA50 && this.quoteStats.lastInterval.close>MA50) {
                signals = this.createSignal();
            }
            else if (this.quoteStats.lastInterval.open>MA50 && this.quoteStats.lastInterval.close<MA50) {
                if (this.intervalCount>MINIMUM_ONE_SIDE_INTERVALS && this.isAboveDailyFiftyMovingAverage) {
                        //Signal Broke dowm
                } else {
                    this.isAboveDailyFiftyMovingAverage = false;
                }
                this.intervalCount=0;
            }
            else if (this.quoteStats.lastInterval.open<MA50 && this.quoteStats.lastInterval.close<MA50) {
                if (!this.isAboveDailyFiftyMovingAverage) {
                    this.intervalCount++;   
                }
            }
            else if (this.quoteStats.lastInterval.open>MA50 && this.quoteStats.lastInterval.close>MA50) {
                const prevMA50 = this.quoteStats.previousInterval?.MA50 || 0
                if (this.quoteStats.previousInterval.close<prevMA50) {
                    signals = this.createSignal();
                }
                if (this.isAboveDailyFiftyMovingAverage) {
                    this.intervalCount++;
                }
            }
         
        }
       
        return signals;
    }

    private createSignal(): SignalModel[]{
        const signals: SignalModel[] = [];

        if (this.intervalCount>MINIMUM_ONE_SIDE_INTERVALS && !this.isAboveDailyFiftyMovingAverage) {
            //Signal Broke up
            this.fiftyMovingAvgBreakTimesCount++;
            signals.push({
                signalGroupType: SignalGroupType.INTRADAY_MOVING_AVERAGE,
                signalType: SignalType.MOVING_AVERAGE_INTRADAY_FIFTY_BREAK_ABOVE,
                signalDescription: SignalVerificationReasonEnum.MOVING_AVERAGE_INTRADAY_FIFTY_BREAK_ABOVE +"("
                +this.fiftyMovingAvgBreakTimesCount+")",
                isDeveloperMode:true
            });
        }
        else {
            this.isAboveDailyFiftyMovingAverage = true;
        }
        this.intervalCount=0;

        return signals;
    }
}