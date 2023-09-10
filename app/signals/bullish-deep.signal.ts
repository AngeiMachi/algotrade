import { SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';
import * as candleUtils from '../utils/candle-utils';
import * as generalUtils from '../utils/general';
import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import {IQuoteFullIntervalData} from '../models/quote-data.model';


export class BullishDeepSignal extends Signals {

    private BullishnessProps!: {
        volumeAndVolatility:boolean,
        didOpenAbove20MADaily:boolean,
        is20MAAbove50MAHourly:boolean,
        is20MABelow50MAHourly:boolean
    } 
    private didSignalTrigger:boolean = false;
    private intervalsToReanbleCount:number=10;
    private isValidForSignal:boolean = false;
    private shouldTouch50MA:boolean =false;
    public monitor(): SignalModel[] {
        let signals: SignalModel[] = [];

        this.initializeBullishnessProps();

        if (this.isValidForSignal) {
            
            this.resetSignal();
    
            if (!this.didSignalTrigger && this.quoteStats.intervalCount>1){
                let candleCount = 0;
                
                for (let i=this.quoteStats.intervalCount-1 ;i>=0 && candleCount<=6;i--) {
                    candleCount++;
                    
                    signals = this.checkBullishSignal(candleCount,i);
                    if (signals.length===0) {
                        signals =  this.checkBearishSignal(candleCount,i);
                    }
                    
                    if (signals.length>0) break;
                }
            }
        }
        return signals;
    }

    initializeBullishnessProps() {
        let didOpenAbove20MADaily:boolean=false;
        let volumeAndVolatility:boolean=false;
        let is20MAAbove50MAHourly:boolean=false;
        let is20MABelow50MAHourly:boolean=false;
        if (this.quoteStats.intervalCount===0 ){
            didOpenAbove20MADaily = this.quoteStats.metadata.SMA20.didOpenOboveSMA || false;
            
            if (this.quoteStats.metadata.averageVolatility30Day>1 && 
                (this.quoteStats.metadata.averageDailyVolume10Day as number>2000000 && this.quoteStats.metadata.averageVolatility30Day>4) ||
                this.quoteStats.metadata.averageDailyVolume10Day as number>5000000) {
                    volumeAndVolatility =true;
                    this.isValidForSignal = true;
            }

            if (this.quoteStats.hourlyMA20Last>this.quoteStats.hourlyMA50Last &&
                this.quoteStats.lastInterval.open>this.quoteStats.hourlyMA50Last &&
                (generalUtils.getPercentageDifference(this.quoteStats.hourlyMA50Last,this.quoteStats.lastInterval.open)>0.3)) {
                    is20MAAbove50MAHourly = true
            } else if  (this.quoteStats.hourlyMA20Last<this.quoteStats.hourlyMA50Last &&
                        this.quoteStats.lastInterval.open<this.quoteStats.hourlyMA50Last &&
                        (generalUtils.getPercentageDifference(this.quoteStats.hourlyMA50Last,this.quoteStats.lastInterval.open)>0.3)) {
                    is20MABelow50MAHourly = true;
            }

            this.BullishnessProps ={
                didOpenAbove20MADaily,
                volumeAndVolatility,
                is20MAAbove50MAHourly,
                is20MABelow50MAHourly
            }
        }
    }

    resetSignal(){
        if (this.didSignalTrigger) {
            this.intervalsToReanbleCount--;
            if (this.intervalsToReanbleCount===0) {
                this.didSignalTrigger = false;
            }
        }
    }

    checkBullishSignal(candleCount:number,interval:number): SignalModel[] {
        const signals: SignalModel[] = [];

        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.quoteIntervals[interval].high); 
        const candleLength =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.lastInterval.high); 
        
        const averageVolatility30Day = this.quoteStats.metadata.averageVolatility30Day;

        if (this.isAnotherCandleFarEnoughFrom10MABullish(this.quoteStats.lastInterval) && 
            this.isCandleClosedInsidePrevCandleBullish() && 
            this.isCandleVolumeStrongEnough() &&
            candleLength*1.7>(percentageDiff/candleCount) && 
            this.quoteStats.lastInterval.low < this.quoteStats.quoteIntervals[interval].low &&
            percentageDiff*1.4>averageVolatility30Day && 
            candleCount>=2 && 
            (candleUtils.isHammer(this.quoteStats.lastInterval) || 
            (candleUtils.isGreeen(this.quoteStats.lastInterval)) && !candleUtils.isInvertedHammer(this.quoteStats.lastInterval) )) {
                signals.push({ 
                    signalGroupType: SignalGroupType.DEEP_OR_PEAK,
                    signalType: SignalType.BULLISH_DEEP,
                    signalDescription: SignalVerificationReasonEnum.BULLISH_DEEP+this.composeBullishMetadata(),
                    withNotification:true,
                });
                this.didSignalTrigger =true;
                this.intervalsToReanbleCount = 4;
                return signals;
        }
        return [];
    }

    checkBearishSignal(candleCount:number,interval:number,): SignalModel[] {
        const signals: SignalModel[] = [];
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.high,this.quoteStats.quoteIntervals[interval].low); 
        const candleLength =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.lastInterval.high); 
        const averageVolatility30Day = this.quoteStats.metadata.averageVolatility30Day;

        if (this.isAnotherCandleFarEnoughFrom10MABearish(this.quoteStats.lastInterval) && 
            this.isCandleClosedInsidePrevCandleBearish() && 
            this.isCandleVolumeStrongEnough() &&
            candleLength*1.7>(percentageDiff/candleCount) && 
            this.quoteStats.lastInterval.high > this.quoteStats.quoteIntervals[interval].high &&
            percentageDiff*1.4>averageVolatility30Day && 
            candleCount>=2 && 
            (candleUtils.isInvertedHammer(this.quoteStats.lastInterval) || 
            (candleUtils.isRed(this.quoteStats.lastInterval)) && !candleUtils.isHammer(this.quoteStats.lastInterval)) ) {
                signals.push({ 
                    signalGroupType: SignalGroupType.DEEP_OR_PEAK,
                    signalType: SignalType.BEARISH_PEAK,
                    signalDescription: SignalVerificationReasonEnum.BEARISH_PEAK +this.composeBearishMetadata(),
                    withNotification:true,
                });
                this.didSignalTrigger =true;
                this.intervalsToReanbleCount = 4;
                return signals;
        }
        return [];
    }


    isAnotherCandleFarEnoughFrom10MABullish(quoteInterval:IQuoteFullIntervalData):boolean {
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
    isAnotherCandleFarEnoughFrom10MABearish(quoteInterval:IQuoteFullIntervalData):boolean {
        const anotherCandleLength = (quoteInterval.high-quoteInterval.low)*1.2;
        if  ((quoteInterval.close>(quoteInterval.MA10 || 100000))){
            if (quoteInterval.close-anotherCandleLength > (quoteInterval.MA10 || 100000)) {
                return true;
            } else {
                return false;
            }
        } 
        return false;
    }

    isCandleClosedInsidePrevCandleBullish():boolean {
        return ((this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].low <= this.quoteStats.lastInterval.close) &&
        this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].low>this.quoteStats.lastInterval.low);
    }
    isCandleClosedInsidePrevCandleBearish():boolean {
        return ((this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].high >= this.quoteStats.lastInterval.close) &&
        this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1].high<this.quoteStats.lastInterval.high);
    }

    isCandleVolumeStrongEnough():boolean {
        return this.quoteStats.lastInterval.volume>50000 
    }

    composeBullishMetadata():string {
        if (this.BullishnessProps.didOpenAbove20MADaily && this.BullishnessProps.is20MAAbove50MAHourly) {
            return '| 💯';
        }
        if (this.BullishnessProps.didOpenAbove20MADaily) {
            return '| 🟡(D)⬆️ ✅';
        }
        if (this.BullishnessProps.is20MAAbove50MAHourly) {
            return '| 🟡🔵 ✅';
        }
        return '';
    }
    composeBearishMetadata():string {
        if (!this.BullishnessProps.didOpenAbove20MADaily && this.BullishnessProps.is20MABelow50MAHourly) {
            return ' | 💯';
        }
        if (!this.BullishnessProps.didOpenAbove20MADaily) {
            return ' | 🟡(D)⬇️ ✅';
        }
        if (this.BullishnessProps.is20MABelow50MAHourly) {
            return ' | 🔵🟡 ✅';
        }
        return '';
    }





}
