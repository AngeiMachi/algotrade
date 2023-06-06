import * as generalUtils from '../utils/general';
import _ from 'lodash';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { Signals } from "./signals";
import { SignalModel } from '../models/signal.model';
import { QuoteStateSignals } from '../models/state.model';

export class BullishBuildingAboveTwentyMA extends Signals {

    private checkedSignals : {[key:string]:boolean} ={};
    private activeTwentyMovingAverageSignal:QuoteStateSignals | null=null;
    monitor(): SignalModel[] { 
        const signals: SignalModel[] = [];

        this.findTwenyMovingAverageSignal();
        if (this.isBuildingAboveTwentyMa()) {
            return [{
                signalGroupType: SignalGroupType.HOURLY_MOVING_AVERAGE,
                signalType: SignalType.BUILDING_ABOVE_TWENTY_MOVING_AVERAGE,
                signalDescription: '🤑 ' + SignalVerificationReasonEnum.BUILDING_ABOVE_TWENTY_MOVING_AVERAGE,
                interval:this.quoteStats.lastInterval
            }];
        }
        
        return signals;
    }

    private findTwenyMovingAverageSignal() {
        if (this.quoteState.signalsHistory) {
            const twentyMovingAverageSignal = _.findLast(this.quoteState.signalsHistory,(signal)=>{
                return signal.signalDetails.signalType === SignalType.MOVING_AVERAGE_INTRADAY_TWENTY_BREAK_ABOVE &&
                        !this.checkedSignals[signal.id];
    
            });
            if (twentyMovingAverageSignal) {
                this.activeTwentyMovingAverageSignal = twentyMovingAverageSignal;
                this.checkedSignals[twentyMovingAverageSignal.id] = true;
            }
        }
        
    }

    private isBuildingAboveTwentyMa() {
        if (this.activeTwentyMovingAverageSignal) {
            if ((this.quoteStats.lastInterval.MA20 || 0)>this.quoteStats.lastInterval.close) {
                this.activeTwentyMovingAverageSignal = null
            }
            else if ((this.quoteStats.lastInterval.intervalNumber ||  this.activeTwentyMovingAverageSignal.interval)>this.activeTwentyMovingAverageSignal.interval+6) {
                const signalIntervalPrice = this.quoteStats.quoteIntervals[this.activeTwentyMovingAverageSignal.interval].high;
                const percentageDiffrence = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,signalIntervalPrice);
                if (this.quoteStats.lastInterval.close<signalIntervalPrice ||percentageDiffrence<0.3) {
                    this.activeTwentyMovingAverageSignal = null;
                    return true;
                } 
            }
        }
        return false;
    }

}