import _ from 'lodash';
import * as generalUtils from '../utils/general';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from "./signals";
import { SignalGroupType, SignalType } from '../models/enums';

const MINIMUM_PERCENTAGE_DISTANCE_TO_ENABLE_SIGNAL = 4;

export class SignalBullishValidator extends Signals {
    
    private validationWWindow:number;

    protected didOpenObovePreviousDay:boolean =false;
    protected didTouch10MA:boolean =false;
    protected didBreakPreviousDay:boolean = false;

    protected didSignalTriggered:boolean = false;
    
    protected signalMetaData:string =' ';
    private didPrevWeekBreak:boolean = false;
    private didBreak52Week:boolean = false;
    private didOpenAboveAllDailyMovingAverages =  false;

    constructor (_quoteStats: QuoteStatistics,validationWindow:number=3) {
        super(_quoteStats);

        this.validationWWindow = validationWindow;
    }
    
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[] = [];

        if (this.quoteStats.intervalCount>=0 && this.quoteStats.intervalCount<this.validationWWindow && !this.didSignalTriggered) {
        
            this.collectBullishData(_signals);
            this.verifyDidOpenObovePreviousDay();
            this.verifyDidTouch10MA();
            this.verifyDidBreakPreviousDay();

        }

        return outputSignals;        
    }

    private collectBullishData(_signals:SignalModel[]) {
        const break52WeekHigh =  _signals.filter(signal=>signal.signalGroupType===SignalGroupType.BULLISH_LEVEL_BREAK && signal.signalType===SignalType.BULLISH_BREAK_52_WEEK_HIGH)[0];
       if (break52WeekHigh && !this.didBreak52Week){
             this.didBreak52Week =  true;
             this.didPrevWeekBreak? this.signalMetaData.replace('/W','/52W'):this.signalMetaData +='/52W';
       } 
       const prevWeekBreak =  _signals.filter(signal=>signal.signalGroupType===SignalGroupType.BULLISH_LEVEL_BREAK && signal.signalType===SignalType.BULLISH_BREAK_PREVIOUS_WEEK)[0];
       if (prevWeekBreak && !this.didPrevWeekBreak && !this.didBreak52Week ){
             this.didPrevWeekBreak =  true;
             this.signalMetaData +='/W';
       } 
    }

    private verifyDidOpenObovePreviousDay() {
        if (this.quoteStats.intervalCount === 0 ){
            const percentangeDistance = generalUtils.getPercentageDifference(this.quoteStats.metadata.previousDay.high,this.quoteStats.lastInterval.open);
            const percentangeDistanceFrom10MA = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.open);
    
            if (this.quoteStats.metadata.previousDay.high<this.quoteStats.lastInterval.open && 
                percentangeDistance>0.3 &&
                percentangeDistanceFrom10MA<5) {
                this.didOpenObovePreviousDay = true;
            }
        }
    }

    private verifyDidTouch10MA() {
        if (!this.didTouch10MA) {
            if (this.quoteStats.metadata.SMA10.didOpenOboveSMA || 
                ((this.quoteStats.metadata.SMA10?.today || 10000)<this.quoteStats.lastInterval.close && this.quoteStats.intervalCount ===0 )){
                const percentangeDistanceFrom10MAtouch = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA10.previousDay,this.quoteStats.lastInterval.low);
                if (percentangeDistanceFrom10MAtouch<2 || this.quoteStats.metadata.SMA10.previousDay>this.quoteStats.lastInterval.low) {
                    this.didTouch10MA = true;
                }
            } 

            // if (this.quoteStats.metadata.SMA20.didOpenOboveSMA || 
            //     ((this.quoteStats.metadata.SMA20?.today || 10000)<this.quoteStats.lastInterval.close && this.quoteStats.intervalCount ===0 )){
            //     const percentangeDistanceFrom20MAtouch = generalUtils.getPercentageDifference(this.quoteStats.metadata.SMA20.previousDay,this.quoteStats.lastInterval.low);
            //     if (percentangeDistanceFrom20MAtouch<2 || this.quoteStats.metadata.SMA20.previousDay>this.quoteStats.lastInterval.low) {
            //         this.didTouch10MA = true;
            //     }
            // }}
        }
        
        
        
    }

    private verifyDidBreakPreviousDay() {
        if (this.quoteStats.quoteIntervals[0].open>=this.quoteStats.metadata.previousDay.low && 
            this.quoteStats.quoteIntervals[0].open<this.quoteStats.metadata.previousDay.high ) {
            if (this.quoteStats.lastInterval.close>this.quoteStats.metadata.previousDay.high) {
                const percentangeDistance =  generalUtils.getPercentageDifference(this.quoteStats.lastInterval.close,this.quoteStats.metadata.previousDay.high);
                if (percentangeDistance>0.3) {
                    this.didBreakPreviousDay = true;
                }
            }
        }
    }

    private isMinimumPercentageDifferenceEnabled():boolean {
        const movingAveragesObj = _.pick(this.quoteStats.metadata, ['SMA20', 'SMA50', 'SMA100', 'SMA200']);
        const movingAverages = Object.entries(movingAveragesObj);
        let movingAveragesAboveCount = 0;

        for (let movingAverage of movingAverages) {
            if (!movingAverage[1].didOpenOboveSMA) {
                if (generalUtils.getPercentageDifference(this.quoteStats.quoteIntervals[0].close,movingAverage[1].previousDay) < MINIMUM_PERCENTAGE_DISTANCE_TO_ENABLE_SIGNAL) {
                    return false;
                }
                movingAveragesAboveCount++;         
            }
        }
        if (movingAveragesAboveCount==movingAverages.length) {
            return false;
        }
        return true;
    }
}