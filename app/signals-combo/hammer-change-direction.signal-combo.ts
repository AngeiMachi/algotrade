import { QuoteStatistics } from '../engine/quote-statistics';
import { SignalBullishValidator } from "../signals/signal-bullish-validator";
import { SignalModel } from '../models/signal.model';
import * as candleUtils from '../utils/candle-utils';
import * as generalUtils from '../utils/general';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { IQuoteFullIntervalData } from '../models/quote-data.model';

export class HammerComboSignal extends SignalBullishValidator {    
    private hammerPointOfReferenceInterval = -1;
    private hammerCount = 0;

    private invertedHammerPointOfReferenceInterval = -1;
    private invertedHammerCount = 0;
    
    private isBullish:boolean = false;
    private isBearish:boolean = false;

    private sequenceInterval:IQuoteFullIntervalData = {} as IQuoteFullIntervalData;

    private isValid:boolean = true;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats)
    }
    
    public monitor(_signals:SignalModel[]):SignalModel[] {
        let outputSignals:SignalModel[]=[];
        super.monitor(_signals);
       
        if (this.quoteStats.intervalCount>=0) {
            const bullishSequence = _signals.filter(signal=>signal.signalType===SignalType.BULLISH_SEQUENCE_MOVE)[0]
            const bearishSequence = _signals.filter(signal=>signal.signalType===SignalType.BEARISH_SEQUENCE_MOVE)[0]

            if (bullishSequence) {
                this.isBullish= true;
                this.sequenceInterval = bullishSequence.interval as IQuoteFullIntervalData;
            } else if (bearishSequence) {
                this.isBearish=true;
                this.sequenceInterval = bearishSequence.interval as IQuoteFullIntervalData;
            }


            if (this.isBullish) {
                if (candleUtils.isHammer(this.quoteStats.lastInterval)) {
                      if (this.quoteStats.lastInterval.close<this.sequenceInterval.close && this.quoteStats.lastInterval.close>this.quoteStats.quoteIntervals[0].low) {
                          this.hammerCount++;
                      }
                }

                if (this.quoteStats.lastInterval.close<this.quoteStats.quoteIntervals[0].low) {
                    this.isValid = false;
                 }
             }
      
             if (this.isBearish) {
                if (candleUtils.isInvertedHammer(this.quoteStats.lastInterval)) {
                      if (this.quoteStats.lastInterval.close>this.sequenceInterval.close && this.quoteStats.lastInterval.close<this.quoteStats.quoteIntervals[0].high) {
                          this.invertedHammerCount++;
                      }
                 }

                 if (this.quoteStats.lastInterval.close>this.quoteStats.quoteIntervals[0].high) {
                    this.isValid = false;
                 }
             }
              
              
              
              if (this.isValid && !this.didSignalTriggered && this.hammerCount>=2 && 
                  this.quoteStats.lastInterval.close>(this.quoteStats.lastInterval.MA10 || 10000) &&
                  (this.quoteStats.lastInterval.MA10 || 1)>(this.quoteStats.lastInterval.MA20 || 10)) {
                  this.didSignalTriggered =true;
                  outputSignals.push({
                      signalGroupType: SignalGroupType.HAMMER_COMBO,
                      signalType: SignalType.BULLISH_HAMMER_SIGNAL,
                      signalDescription: SignalVerificationReasonEnum.BULLISH_HAMMER_SIGNAL,
                      withNotification:true,
                  });
              } else if (this.isValid && !this.didSignalTriggered && this.invertedHammerCount>=2 && 
                         this.quoteStats.lastInterval.close<(this.quoteStats.lastInterval.MA10 || 10000) &&
                         (this.quoteStats.lastInterval.MA10|| 10)<(this.quoteStats.lastInterval.MA20 || 1)) {
                  this.didSignalTriggered =true;
                  outputSignals.push({
                      signalGroupType: SignalGroupType.HAMMER_COMBO,
                      signalType: SignalType.BEARISH_HAMMER_SIGNAL,
                      signalDescription: SignalVerificationReasonEnum.BEARISH_HAMMER_SIGNAL,
                      withNotification:true,
                  });
              }
        }

        return [...outputSignals,..._signals];
    }
}