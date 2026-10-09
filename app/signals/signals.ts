import { SignalVerificationReasonEnum } from '../models/enums';
import { SignalModel } from '../models/signal.model';
import { QuoteStatistics } from '../engine/quote-statistics';
import { QuoteState } from '../models/state.model';
import * as quoteState from '../engine/state';
import * as generalUtils from '../utils/general';
import * as globalConfig from '../config/globals.config';

export abstract class Signals {
    protected quoteStats: QuoteStatistics;
    protected quoteState:QuoteState;

    constructor(_quoteStats: QuoteStatistics, todayDate: string = '') {
        this.quoteStats = _quoteStats;
        this.quoteState = quoteState.getQuoteStateByName(_quoteStats.quoteName);
    }

    public abstract monitor(_signals?:SignalModel[]): SignalModel[];

    getBullishIndicator():string {
        if (!globalConfig.ShowStarRating) {
            return '';
        }
        let is20MAAbove50MAHourly = false;
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.hourlyMA20Last,this.quoteStats.hourlyMA50Last);
        if (this.quoteStats.hourlyMA20Last>this.quoteStats.hourlyMA50Last && percentageDiff>0.8) {
            is20MAAbove50MAHourly =true;
        }
            
        if (this.quoteStats.metadata.SMA20.didOpenOboveSMA && is20MAAbove50MAHourly) {
            return ' ⭐⭐⭐';
        } else {
            return '';
        }
    }
    
    getBearishIndicator():string {
        if (!globalConfig.ShowStarRating) {
            return '';
        }
        let is20MABelow50MAHourly = false;
        const percentageDiff = generalUtils.getPercentageDifference(this.quoteStats.hourlyMA20Last,this.quoteStats.hourlyMA50Last);
        if (this.quoteStats.hourlyMA20Last<this.quoteStats.hourlyMA50Last && percentageDiff>0.8) {
            is20MABelow50MAHourly =true;
        }
            
        if (!this.quoteStats.metadata.SMA20.didOpenOboveSMA && is20MABelow50MAHourly) {
            return ' ⭐⭐⭐';
        } else {
            return '';
        }
    }
}
