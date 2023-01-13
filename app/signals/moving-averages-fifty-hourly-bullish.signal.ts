import * as generalUtils from '../utils/general';
import { SignalModel } from '../models/signal.model';
import { Signals } from "./signals";
import { SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';

export class MovingAveragesFiftyHourlyBullish extends Signals {


    private lastPotentialHOD:number=0;
    private lastValidHOD:number=0;
    private isValidFor50MA:boolean=false
    private isDirty=true;
    public monitor(): SignalModel[] {
        this.recordNewHOD();
        this.validateFor50MA();
        if(this.is50MATouched()){
            const movingAvgData = this.composeMovingAverages();
            return [{
                signalGroupType: SignalGroupType.HOURLY_MOVING_AVERAGE,
                signalType: SignalType.HOURLY_MOVING_AVERAGE_TOUCH_FROM_ABOVE,
                signalDescription: SignalVerificationReasonEnum.FIFTY_HOURLY_MOVING_AVERAGE_TOUCH_FROM_ABOVE+movingAvgData,
                withNotification:true,
            }];
        }
        
        return [];
        
    }

    is50MATouched() {
        if (this.isValidFor50MA) {
            const MA50 =this.quoteStats.hourlyMA50[this.quoteStats.hourlyMA50.length-1];
            const percentangeDistance = generalUtils.getPercentageDifference(MA50,this.quoteStats.lastInterval.low);
            const previousMA = this.quoteStats.hourlyMA50[this.quoteStats.hourlyMA50.length-2];
            const MAprecentage = generalUtils.getPercentageDifference(previousMA,MA50);
            const MAangleScore = MAprecentage*2.2+0.05;
            if ((percentangeDistance<MAangleScore  || this.quoteStats.lastInterval.low<MA50)  && previousMA<MA50 ) {
                this.isValidFor50MA=false;
                this.lastPotentialHOD = 0;
                this.lastValidHOD= 0;
                this.isDirty=true;
                return true;
            }
        }
        return false;
    }

    private validateFor50MA() {
        const MA50 =this.quoteStats.hourlyMA50Last;
        if (!this.isValidFor50MA) {
            const percentange = generalUtils.getPercentageDifference(MA50,this.lastValidHOD);
            if ((percentange>1.5 || (percentange>1.1 && this.quoteStats.intervalCount<7)) && MA50<this.lastValidHOD) {
                this.isValidFor50MA = true;
            }
        }
    }

    private recordNewHOD(){
        if (this.quoteStats.intervalCount === 0) {
            const premarketHigh=this.quoteStats.metadata.preMarketMetadata?.preMarketHOD.high || 0;
            if (this.quoteStats.lastInterval.close>this.quoteStats.hourlyMA50Last) {
                this.isDirty=false;
                if (premarketHigh>this.quoteStats.hourlyMA50Last) {
                    this.lastPotentialHOD =  premarketHigh;
                    this.lastValidHOD =premarketHigh;
                } else {
                    this.lastPotentialHOD=0;
                    this.lastValidHOD =0;
                }
            }                
        } else if (this.quoteStats.intervalCount>0) {
            if (this.quoteStats.lastInterval.high>this.lastPotentialHOD && this.quoteStats.lastInterval.high>this.quoteStats.hourlyMA50Last){
                this.lastPotentialHOD = this.quoteStats.lastInterval.high;
                if (!this.isDirty) {
                    this.lastValidHOD = this.quoteStats.lastInterval.high;
                }
            }
            if(this.quoteStats.lastInterval.timeNewYork.toString().includes(':55:00')) {
                const percentange = generalUtils.getPercentageDifference(this.quoteStats.hourlyMA50Last,this.quoteStats.lastInterval.close);
                if (this.quoteStats.lastInterval.close>this.quoteStats.hourlyMA50Last && percentange>1) {
                    this.lastValidHOD=this.lastPotentialHOD;
                } else {
                    this.lastPotentialHOD =0;
                    this.lastValidHOD = 0;
                }
            }
        }
    }

    private composeMovingAverages():string {
        let movingAVgsData = '';
        let count=0;
        const MA20 =this.quoteStats.hourlyMA20[this.quoteStats.hourlyMA20.length-1];
        const previousMA = this.quoteStats.hourlyMA20[this.quoteStats.hourlyMA20.length-2];
        const MAprecentage = generalUtils.getPercentageDifference(previousMA,MA20);
        if (MAprecentage>0.8) {
            movingAVgsData = '🟢';
        }
        else if (MAprecentage>0.6) {
            movingAVgsData = '🟡';
        }
        else if (MAprecentage>0.4) {
            movingAVgsData = '🟠';
        }
        else {
            movingAVgsData = '🔴';
        }
        movingAVgsData+=' ';
        if(this.quoteStats.intervalCount<7) {
            if (this.quoteStats.lastInterval.close>(this.quoteStats?.lastInterval?.MA20 || 10000)) {
                if (generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats?.lastInterval?.MA20 || 10000)>0.2) {
                    movingAVgsData+='20m,';
                    count++;
                }
            }
            if (this.quoteStats.lastInterval.close>(this.quoteStats?.lastInterval?.MA50 || 10000)) {
                if (generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats?.lastInterval?.MA50 || 10000)>0.3) {
                    movingAVgsData+='50m,';
                    count++;
                }
            }
            if (this.quoteStats.lastInterval.close>(this.quoteStats?.metadata.SMA20.today || 10000)) {
                if (movingAVgsData) {
                    movingAVgsData+=' | ';
                }
                movingAVgsData+='20D';
                count++;
            }
        }
        
        
        if (movingAVgsData && count===3) {
            return (' 🤑-'+ movingAVgsData);
        }
        return movingAVgsData;
    }

    
}