import * as quoteUtils from '../utils/quote-utils';

import { QuoteStatistics } from '../engine/quote-statistics';
import { Signals } from './signals';
import { SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { SignalModel } from '../models/signal.model';

export class BullishVolumeSignal extends Signals {
    private movingAverageVolumeTen: number = 0;
    private isAsFirstVolumeSignalAccoured: boolean = false;

    constructor(_quoteStats: QuoteStatistics) {
        super(_quoteStats);
    }

    public monitor(): SignalModel[] {
        const signals: SignalModel[] = [];

        this.recordMovingAverage();

        if (this.quoteStats.intervalCount >= 2 && this.quoteStats.intervalCount < 71) {
            if (this.isExtremeVolume()) {
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_VOLUME,
                    signalType: SignalType.VOLUME_AVERAGE_SPIKE,
                    signalDescription: SignalVerificationReasonEnum.VOLUME_AVERAGE_SPIKE,
                    withNotification:true,
                });
            }
            if (this.isSuperExtremeVolumeInterval()) {
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_VOLUME,
                    signalType: SignalType.SUPER_VOLUME_INTERVAL,
                    signalDescription: SignalVerificationReasonEnum.SUPER_VOLUME_INTERVAL,
                    withNotification:true,
                });
            }
            if (this.isAsFirstVolume()) {
                signals.push({
                    signalGroupType: SignalGroupType.BULLISH_VOLUME,
                    signalType: SignalType.AS_FIRST_VOLUME_INTERVAL,
                    signalDescription: SignalVerificationReasonEnum.AS_FIRST_VOLUME_INTERVAL,
                    withNotification:true,
                });
            }
        }
        return signals;
    }

    private isAsFirstVolume() {
        if (this.quoteStats.lastInterval.volume * 1.2 >= this.quoteStats.quoteIntervals[0].volume && !this.isAsFirstVolumeSignalAccoured) {
            if (((this.quoteStats.metadata.averageDailyVolume3Month as number) / 78) * 1.5 <= this.quoteStats.lastInterval.volume) {
                if (quoteUtils.isCandleBullish(this.quoteStats.lastInterval)) {
                    this.isAsFirstVolumeSignalAccoured = true;
                    return true;
                }
            }
        }
    }

    private isExtremeVolume(): boolean {
        if (this.quoteStats.lastInterval.volume > this.movingAverageVolumeTen * 5 && this.movingAverageVolumeTen != 0) {
            if (
                quoteUtils.isCandleBullish(this.quoteStats.lastInterval) &&
                quoteUtils.getPercentageChange(this.quoteStats.lastInterval, this.quoteStats.metadata.previousDay.close, false) > 1
            ) {
                return true;
            }
        }
        return false;
    }

    private isSuperExtremeVolumeInterval(): boolean {
        if (this.quoteStats.metadata.averageDailyVolume10Day as number <= this.quoteStats.lastInterval.volume &&
            this.quoteStats.metadata.averageDailyVolume10Day as number>0) {
            return true;
        }
        return false;
    }

    private recordMovingAverage() {
        let sum = 0;
        if (this.quoteStats.intervalCount > 10) {
            for (let i = this.quoteStats.intervalCount - 10; i < this.quoteStats.intervalCount; i++) {
                sum += this.quoteStats.quoteIntervals[i].volume;
            }
        }
        this.movingAverageVolumeTen = sum / 10;
    }
}
