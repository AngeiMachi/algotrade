import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from './signals';
import _ from 'lodash';
import { SignalModel } from '../models/signal.model';

export class MovingAveragesSignal extends Signals {
    private movingAverages: any[] = [];

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }

    public monitor(): SignalModel[] {
        if (this.quoteStats.intervalCount === 0) {
            const movingAveragesObj = _.pick(this.quoteStats.metadata, ['SMA20', 'SMA50', 'SMA100', 'SMA200']);
            this.movingAverages = Object.entries(movingAveragesObj);
        }
        return this.monitorTouchMA();
    }
    private monitorTouchMA(): SignalModel[] {
        let signals: SignalModel[] = [];
        for (let movingAverage of this.movingAverages) {
            if (movingAverage[1].didOpenOboveSMA) {
                if (this.quoteStats.lastInterval.open > movingAverage[1].today && this.quoteStats.lastInterval.low <= movingAverage[1].today && !movingAverage[2]) {
                    signals.push({
                        signalGroupType: SignalGroupType.MOVING_AVERAGES,
                        signalType: SignalType.MOVING_AVERAGE_TOUCH_FROM_BELOW,
                        signalDescription: SignalVerificationReasonEnum.MOVING_AVERAGE_TOUCH_FROM_BELOW + '(' + movingAverage[0] + ')',
                        payload: { type: movingAverage[0] },
                    });
                    movingAverage[2] = true;
                }
            } else {
                if (this.quoteStats.lastInterval.open < movingAverage[1].today && this.quoteStats.lastInterval.high >= movingAverage[1].today && !movingAverage[2]) {
                    signals.push({
                        signalGroupType: SignalGroupType.MOVING_AVERAGES,
                        signalType: SignalType.MOVING_AVERAGE_TOUCH_FROM_ABOVE,
                        signalDescription: SignalVerificationReasonEnum.MOVING_AVERAGE_TOUCH_FROM_ABOVE + '(' + movingAverage[0] + ')',
                        payload: { type: movingAverage[0] },
                    });
                    movingAverage[2] = true;
                }
            }
        }

        return signals;
    }
}
