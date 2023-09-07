import { SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';
import * as candleUtils from '../utils/candle-utils';
import * as generalUtils from '../utils/general';
import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import {IQuoteFullIntervalData} from '../models/quote-data.model';
export class BullishDeepSignal extends Signals {

    private didSignalTrigger:boolean = false;
    private intervalsToReanbleCount:number=10;
    private isValidForSignal:boolean = false;
    private shouldTouch50MA:boolean =false;
    public monitor(): SignalModel[] {
        const signals: SignalModel[] = [];

        if (this.quoteStats.intervalCount===0 && 
            //(generalUtils.getPercentageDifference(this.quoteStats.hourlyMA20Last,this.quoteStats.lastInterval.open)>0.3) &&
            this.quoteStats.metadata.SMA20.didOpenOboveSMA &&
            (this.quoteStats.metadata.averageVolatility30Day>1 && 
            (this.quoteStats.metadata.averageDailyVolume10Day as number>2000000) ||  this.quoteStats.metadata.averageDailyVolume10Day as number>5000000)) {
                if (this.quoteStats.hourlyMA20Last<this.quoteStats.lastInterval.open) {
                    this.isValidForSignal = true;
                } else if (this.quoteStats.hourlyMA50Last<this.quoteStats.lastInterval.open && this.quoteStats.hourlyMA50Last<this.quoteStats.hourlyMA20Last) {
                    this.isValidForSignal = true;
                    this.shouldTouch50MA = true;
                } else {
                    this.isValidForSignal = false;
                }
        }

        if (this.isValidForSignal) {
            if (this.didSignalTrigger) {
                this.intervalsToReanbleCount--;
                if (this.intervalsToReanbleCount===0) {
                    this.didSignalTrigger = false;
                }
            }
    
            if (this.quoteStats.intervalCount>1 && !this.didSignalTrigger){
                let candleCount =0;
                const averageVolatility30Day = this.quoteStats.metadata.averageVolatility30Day;
                for (let i=this.quoteStats.intervalCount-1 ;i>=0 && candleCount<=6;i--) {
                    candleCount++;
    
                    const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.quoteIntervals[i].high); 
                    const candleLength =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.lastInterval.high); 
                    
                    if (this.isAnotherCandleFarEnoughFrom10MA(this.quoteStats.lastInterval) && 
                        this.isCandleClosedInsidePrevCandle() && 
                        candleLength*1.7>(percentageDiff/candleCount) && 
                        this.quoteStats.lastInterval.low < this.quoteStats.quoteIntervals[i].low &&
                        percentageDiff*1.4>averageVolatility30Day && 
                        candleCount>=2 && 
                        this.quoteStats.lastInterval.volume>50000 &&
                        (candleUtils.isHammer(this.quoteStats.lastInterval) || candleUtils.isGreeen(this.quoteStats.lastInterval)) ) {
                            signals.push({ 
                                signalGroupType: SignalGroupType.DEEP_OR_PEAK,
                                signalType: SignalType.BULLISH_DEEP,
                                signalDescription: SignalVerificationReasonEnum.BULLISH_DEEP,
                                withNotification:true,
                            });
                            this.didSignalTrigger =true;
                            this.intervalsToReanbleCount = 4;
                            break;
                    }
                    
                }
            }
        }
        
        return signals;
       
    }

    isAnotherCandleFarEnoughFrom10MA(quoteInterval:IQuoteFullIntervalData):boolean {
        const anotherCandleLength = (quoteInterval.high-quoteInterval.low)*1.2;
        if  ((quoteInterval.close<(quoteInterval.MA10 || 0))){
            if (quoteInterval.close+anotherCandleLength < (quoteInterval.MA10 || 0)) {
                return true;
            } else {
                return false;
            }
        } 
        return false;
    }

    isCandleClosedInsidePrevCandle():boolean {
        return ((this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].low <= this.quoteStats.lastInterval.close) &&
        this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].low>this.quoteStats.lastInterval.low);
    }


}
