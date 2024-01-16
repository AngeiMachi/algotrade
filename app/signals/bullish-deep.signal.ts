import { MADirectionEnum, SignalGroupType,SignalType,SignalVerificationReasonEnum } from '../models/enums';
import * as candleUtils from '../utils/candle-utils';
import * as generalUtils from '../utils/general';
import { Signals } from './signals';
import { SignalModel } from '../models/signal.model';
import {IQuoteFullIntervalData} from '../models/quote-data.model';
import * as state from '../engine/state';

const sensitivity = 1.4;
const movementStrength = 0.6; // at leaset 60% of the daily movement
export class BullishDeepSignal extends Signals {

    private candlesLength:number[] =[];
    private averageLongestCandlesLength:number=0;
    private BullishnessProps!: {
        volumeAndVolatility:boolean,
        didOpenAbove20MADaily:boolean,
        is20MAAbove50MAHourly:boolean,
        is20MABelow50MAHourly:boolean
    } 
    private didSignalTrigger:boolean = false;
    private intervalsToReanbleCount:number=10;
    private isValidForSignal:boolean = false;

    private bullishMeasuredMove:number=0;
    private bullishMeasuredMoveInterval:IQuoteFullIntervalData={} as IQuoteFullIntervalData;
    private bearishMeasuredMove:number=0;
    private bearishMeasuredMoveInterval:IQuoteFullIntervalData={} as IQuoteFullIntervalData;
    
    private HOD:number=0;
    private LOD:number=100000;

    public monitor(): SignalModel[] {
        let signals: SignalModel[] = [];

        this.initializeBullishnessProps();
        if (this.isValidForSignal) {

            this.resetMeasuredMove();
            
            this.updateAverageCandleLength();

            this.resetSignal();
    
            if (!this.didSignalTrigger && this.quoteStats.intervalCount>1){
                let candleCount = 0;
                let candleLengthSum =0;
                
                for (let i=this.quoteStats.intervalCount-1 ;i>=0 && candleCount<=6;i--) {
                    candleCount++;
                    candleLengthSum+= this.quoteStats.quoteIntervals[i].high -this.quoteStats.quoteIntervals[i].low;
                    this.measureMove(i);
                    if (signals.length==0) {
                        signals = this.checkBullishSignal(candleCount,candleLengthSum/candleCount,i);
                    }
                    if (signals.length===0) {
                        signals =  this.checkBearishSignal(candleCount,candleLengthSum/candleCount,i);
                    } 
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
                this.quoteStats.metadata.averageDailyVolume10Day as number>4000000) {
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

    checkBullishSignal(candleCount:number,deepAverageCandleLength:number,interval:number): SignalModel[] {
        const signals: SignalModel[] = [];

        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.quoteIntervals[interval].high); 
        const candleLengthPercentage =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.lastInterval.high); 
        const candleLength = this.quoteStats.lastInterval.high-this.quoteStats.lastInterval.low;
        const prevCandle = this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1];

        if (
            this.isCandleClosedInsidePrevCandleBullish() && 
            this.isCandleVolumeStrongEnough() &&
            candleLengthPercentage*1.7>(percentageDiff/candleCount) && 
            this.isMovementStrongEnoughForBullish(interval) &&
            //candleLength>(this.averageLongestCandlesLength * 2/3) &&
            
            candleCount>=2 && 
            (candleUtils.isHammer(this.quoteStats.lastInterval) || 
            (candleUtils.isGreeen(this.quoteStats.lastInterval)) && !candleUtils.isInvertedHammer(this.quoteStats.lastInterval) )) {
                if (this.isAnotherCandleFarEnoughFrom10MABullish(this.quoteStats.lastInterval)) {
                    signals.push({ 
                        signalGroupType: SignalGroupType.DEEP_OR_PEAK,
                        signalType: SignalType.BULLISH_DEEP,
                        signalDescription: SignalVerificationReasonEnum.BULLISH_DEEP+this.getBullishIndicator()+this.getBullishMeasuredMove(),
                        socialSignalDescription:'Potential '+SignalVerificationReasonEnum.BULLISH_DEEP+" Verified ✔"+"\n\n Measured Move from top to bottom: "+this.getBullishMeasuredMove()+
                        +'\n\nShort term(mins) direction: Bullish 🟢! '+this.getBullishIndicator()+'\n\nStop loss: '+this.quoteStats.lastInterval.low.toFixed(2),
                        withNotification:true,
                    });
                    this.didSignalTrigger =true;
                    this.intervalsToReanbleCount = 4;
                } else {
                    state.updaeTacticalDirectionSignal(this.quoteStats.quoteName,"SOFT",MADirectionEnum.UP,SignalVerificationReasonEnum.BULLISH_DEEP,false);
                }
              
                return signals;
        }
        return [];
    }

    checkBearishSignal(candleCount:number,peakAverageCandleLength:number,interval:number,): SignalModel[] {
        const signals: SignalModel[] = [];
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.high,this.quoteStats.quoteIntervals[interval].low); 
        const candleLengthPercentage =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.lastInterval.high); 
        const candleLength = this.quoteStats.lastInterval.high-this.quoteStats.lastInterval.low;
        const prevCandle = this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-1];

        if (
            this.isCandleClosedInsidePrevCandleBearish() && 
            this.isCandleVolumeStrongEnough() &&
            candleLengthPercentage*1.7>(percentageDiff/candleCount) && 
            this.isMovementStrongEnoughForBearish(interval) &&
            //candleLength>(this.averageLongestCandlesLength * 2/3) &&
            
            candleCount>=2 && 
            (candleUtils.isInvertedHammer(this.quoteStats.lastInterval) || 
            (candleUtils.isRed(this.quoteStats.lastInterval)) && !candleUtils.isHammer(this.quoteStats.lastInterval)) ) {
                if (this.isAnotherCandleFarEnoughFrom10MABearish(this.quoteStats.lastInterval)) {
                    signals.push({ 
                        signalGroupType: SignalGroupType.DEEP_OR_PEAK,
                        signalType: SignalType.BEARISH_PEAK,
                        signalDescription: SignalVerificationReasonEnum.BEARISH_PEAK +this.getBearishIndicator()+this.getBearishMeasuredMove(),
                        socialSignalDescription:'Potential '+SignalVerificationReasonEnum.BEARISH_PEAK+" Verified ✔"+"\n\n Measured Move from bottom to top: "+this.getBearishMeasuredMove()
                        +'\n\nShort term(mins) direction: Bearish 🔴! '+this.getBearishIndicator()+'\n\nStop loss: '+this.quoteStats.lastInterval.high.toFixed(2),
                        withNotification:true,
                    });
                    this.didSignalTrigger =true;
                    this.intervalsToReanbleCount = 4;
                }  else {
                    state.updaeTacticalDirectionSignal(this.quoteStats.quoteName,"SOFT",MADirectionEnum.DOWN,SignalVerificationReasonEnum.BEARISH_PEAK,false);
                }
                return signals;
        }
        return [];
    }


    isAnotherCandleFarEnoughFrom10MABullish(quoteInterval:IQuoteFullIntervalData):boolean {
        const anotherCandleLength = (quoteInterval. high-quoteInterval.low)*1.2;
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
        return this.quoteStats.lastInterval.volume>100000 
    }

    getBullishMeasuredMove():string {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.bullishMeasuredMoveInterval.high).toFixed(1);
        return '('+percentageDiff+'%)'
    }
    getBearishMeasuredMove():string {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.high,this.bearishMeasuredMoveInterval.low).toFixed(1);
        return '('+percentageDiff+'%)'
    }

    composeBullishMetadata():string {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.bullishMeasuredMoveInterval.high).toFixed(1);
        if (this.BullishnessProps.didOpenAbove20MADaily && this.BullishnessProps.is20MAAbove50MAHourly) {
            return '| 💯 ('+percentageDiff+'%)';
        }
        if (this.BullishnessProps.didOpenAbove20MADaily) {
            return '| 🟡(D)⬆️ ✅ ('+percentageDiff+'%)';
        }
        if (this.BullishnessProps.is20MAAbove50MAHourly) {
            return '| 🟡🔵 ✅ ('+percentageDiff+'%)';
        }
        return '('+percentageDiff+'%)';;
    }

    composeBearishMetadata():string {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.high,this.bearishMeasuredMoveInterval.low).toFixed(1);
        if (!this.BullishnessProps.didOpenAbove20MADaily && this.BullishnessProps.is20MABelow50MAHourly) {
            return ' | 💯 ('+percentageDiff+'%)';
        }
        if (!this.BullishnessProps.didOpenAbove20MADaily) {
            return ' | 🟡(D)⬇️ ✅ ('+percentageDiff+'%)';
        }
        if (this.BullishnessProps.is20MABelow50MAHourly) {
            return ' | 🔵🟡 ✅ ('+percentageDiff+'%)';
        }
        return '('+percentageDiff+'%)';
    }

    updateAverageCandleLength() {
        const candleLength = this.quoteStats.lastInterval.high-this.quoteStats.lastInterval.low;
        
        this.candlesLength.push(candleLength);
        this.candlesLength.sort((a, b) => b - a);
        const longCandles = this.candlesLength.slice(0,6);
        const sum = longCandles.reduce((accumulator, currentValue) => {
            return accumulator + currentValue;
            }, 0);
        this.averageLongestCandlesLength =sum/longCandles.length;
        

        
    }

    measureMove(intervalNumber:number){
        if (this.quoteStats.lastInterval.high-this.quoteStats.quoteIntervals[intervalNumber].low>this.bearishMeasuredMove) {
            this.bearishMeasuredMove = this.quoteStats.lastInterval.high-this.quoteStats.quoteIntervals[intervalNumber].low;
            this.bearishMeasuredMoveInterval = this.quoteStats.quoteIntervals[intervalNumber];
        }
        if (this.quoteStats.quoteIntervals[intervalNumber].high-this.quoteStats.lastInterval.low>this.bullishMeasuredMove) {
            this.bullishMeasuredMove = this.quoteStats.quoteIntervals[intervalNumber].high-this.quoteStats.lastInterval.low;
            this.bullishMeasuredMoveInterval = this.quoteStats.quoteIntervals[intervalNumber];
        }

      
    }
    resetMeasuredMove(){
        this.bearishMeasuredMove = this.quoteStats.lastInterval.high-this.quoteStats.lastInterval.low;
        this.bullishMeasuredMove = this.quoteStats.lastInterval.high-this.quoteStats.lastInterval.low;
    }

    isMovementStrongEnoughForBullish(interval:number):boolean {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.low,this.quoteStats.quoteIntervals[interval].high); 
        if (this.quoteStats.lastInterval.close<this.quoteStats.quoteIntervals[interval].low &&
            percentageDiff*sensitivity>this.quoteStats.metadata.averageVolatility30Day &&
            (movementStrength*(this.quoteStats.HOD-this.quoteStats.LOD))<=this.bullishMeasuredMove &&
            (movementStrength*(this.quoteStats.HOD-this.quoteStats.LOD))<=this.quoteStats.quoteIntervals[interval].high-this.quoteStats.lastInterval.close) {
            return true;
        }
        return false;
    }
    isMovementStrongEnoughForBearish(interval:number):boolean {
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.lastInterval.high,this.quoteStats.quoteIntervals[interval].low); 

        if (this.quoteStats.lastInterval.close > this.quoteStats.quoteIntervals[interval].high &&
            percentageDiff*sensitivity>this.quoteStats.metadata.averageVolatility30Day &&
            (movementStrength*(this.quoteStats.HOD-this.quoteStats.LOD))<=this.bearishMeasuredMove &&
            (movementStrength*(this.quoteStats.HOD-this.quoteStats.LOD))<=this.quoteStats.lastInterval.close-this.quoteStats.quoteIntervals[interval].low) {
            return true;
        }
        return false;
    }
}
