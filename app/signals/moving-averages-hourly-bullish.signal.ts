import * as generalUtils from '../utils/general';
import { SignalModel } from '../models/signal.model';
import { Signals } from "./signals";
import { SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';

export class MovingAveragesHourlyBullish extends Signals {


    private lastPotentialHOD:number=0;
    private lastValidHOD:number=0;
    private isValidFor20MA:boolean=false
    private isDirty=true;
    public monitor(): SignalModel[] {
        this.recordNewHOD();
        this.validateFor20MA();
        if(this.is20MATouched()){
            return [{
                signalGroupType: SignalGroupType.HOURLY_MOVING_HAVEERAGE,
                signalType: SignalType.HOURLY_MOVING_AVERAGE_TOUCH_FROM_ABOVE,
                signalDescription: SignalVerificationReasonEnum.TWENTY_HOURLY_MOVING_AVERAGE_TOUCH_FROM_ABOVE ,
            }];
        }
        
        return [];
        
    }

    is20MATouched() {
        if (this.isValidFor20MA) {
            const MA20 =this.quoteStats.hourlyMA20[this.quoteStats.hourlyMA20.length-1];
            const percentangeDistance = generalUtils.getPercentageDifference(MA20,this.quoteStats.lastInterval.low);
            const previousMA = this.quoteStats.hourlyMA20[this.quoteStats.hourlyMA20.length-2];
            const MAprecentage = generalUtils.getPercentageDifference(previousMA,MA20);
            const MAangleScore = MAprecentage*2.2+0.05;
            if ((percentangeDistance<MAangleScore  || this.quoteStats.lastInterval.low<MA20)  && previousMA<MA20 ) {
                this.isValidFor20MA=false;
                this.lastPotentialHOD = 0;
                this.lastValidHOD= 0;
                this.isDirty=true;
                return true;
            }
        }
        return false;
    }

    private validateFor20MA() {
        const MA20 =this.quoteStats.hourlyMA20Last;
        if (!this.isValidFor20MA) {
            const percentange = generalUtils.getPercentageDifference(MA20,this.lastValidHOD);
            if (percentange>1.5 && MA20<this.lastValidHOD) {
                this.isValidFor20MA = true;
            }
        }
    }

    private recordNewHOD(){
        if (this.quoteStats.intervalCount === 0) {
            const premarketHigh=this.quoteStats.metadata.preMarketMetadata?.preMarketHOD.high || 0;
            if (this.quoteStats.lastInterval.open>this.quoteStats.hourlyMA20Last) {
                this.isDirty=false;
                if (premarketHigh>this.quoteStats.hourlyMA20Last) {
                    this.lastPotentialHOD =  premarketHigh;
                    this.lastValidHOD =premarketHigh;
                } else {
                    this.lastPotentialHOD=0;
                    this.lastValidHOD =0;
                }
            } 
           
        }
        if (this.quoteStats.lastInterval.high>this.lastPotentialHOD && this.quoteStats.lastInterval.high>this.quoteStats.hourlyMA20Last){
            this.lastPotentialHOD = this.quoteStats.lastInterval.high;
            if (!this.isDirty) {
                this.lastValidHOD = this.quoteStats.lastInterval.high;
            }
        }
        if(this.quoteStats.lastInterval.timeNewYork.toString().includes(':55:00')) {
            const percentange = generalUtils.getPercentageDifference(this.quoteStats.hourlyMA20Last,this.quoteStats.lastInterval.close);
            if (this.quoteStats.lastInterval.close>this.quoteStats.hourlyMA20Last && percentange>1) {
                this.lastValidHOD=this.lastPotentialHOD;
            } else {
                this.lastPotentialHOD =0;
                this.lastValidHOD = 0;
            }
        }
    }

    
}