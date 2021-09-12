import moment from 'moment-timezone';
import * as _ from 'lodash';

import * as pushed from '../proxy/pushed-api';
import * as quoteUtiles from '../utils/quote-utils';

import { IMarketHours, IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';
import { BuyDirectionEnum, buyReasonEnum, SignalVerificationReasonEnum } from '../models/enums';
import { logger } from '../config/winston.config';
import { BullishHODSignal } from '../signals/bullish-hod.signal';
import { QuoteStats } from './quote-stats';
import { BullishLevelBreakSignal } from '../signals/bullish-level-break.signal';

export class QuoteMonoRunner {
    private quoteStats: QuoteStats;

    public quoteIntervals: IQuoteFullIntervalData[] = [];

    private signals: SignalVerificationReasonEnum[] = [];

    private bullishHODSignal!: BullishHODSignal;
    private bullishLevelBreakSignal!: BullishLevelBreakSignal;

    constructor(quote: string, todayDate: string = '') {
        this.quoteStats = new QuoteStats(quote, todayDate);
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata, marketHours: IMarketHours) {
        this.quoteStats.registerMetadata(quoteMetadata);

        quoteIntervals = quoteUtiles.cleanPreMarketIntervals(quoteIntervals, marketHours);
        //this.quoteStats.initializeStockIntervalsSoFar(quoteIntervals);

        this.bullishHODSignal = new BullishHODSignal(this.quoteStats);
        this.bullishLevelBreakSignal = new BullishLevelBreakSignal(this.quoteStats);

        Object.keys(quoteIntervals).forEach((key) => {
            this.recordNewStockInterval(quoteIntervals[key]);
        });
    }

    public recordNewStockInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false): number {
        this.quoteStats.addNewInterval(quoteInterval, isLive);
        this.quoteStats.composeAndPrintCurrentIntervalStats(quoteInterval, isLive);

        //...this.bullishHODSignal.monitor(),
        this.signals = [...this.bullishHODSignal.monitor(), ...this.bullishLevelBreakSignal.monitor()];

        if (this.signals.length > 0) {
            //logger.debug(JSON.stringify(quoteInterval));
            this.signals.forEach((signal) => {
                logger.info(signal);
            });
        }

        return 0;
    }

    // private calculateAverageVolume(stockInterval: IQuoteFullIntervalData) {
    //     this.volumeSum += stockInterval.volume;
    //     this.averageVolume = this.volumeSum / (this.interval + 1);
    // }
    // private isExtremeVolume(): boolean {
    //     if (((this.quoteMetadata.averageDailyVolume10Day as number) / 78) * 1.8 <= this.averageVolume) {
    //         return true;
    //     }

    //     return false;
    // }

    // private isSuperExtremeVolumeInterval(quoteInterval: IQuoteFullIntervalData): boolean {
    //     if (this.quoteMetadata.averageDailyVolume10Day <= quoteInterval.volume * 4) {
    //         return true;
    //     }
    //     return false;
    // }

    // private isAsFirstVolume(quoteInterval: IQuoteFullIntervalData) {
    //     if (quoteInterval.volume * 1.2 >= this.quoteIntervals[0].volume) {
    //         if (((this.quoteMetadata.averageDailyVolume3Month as number) / 78) * 1.5 <= quoteInterval.volume) {
    //             return true;
    //         }
    //     }
    // }

    // private monitorHOD(stockInterval: IQuoteFullIntervalData) {
    //     if (this.interval === 0) {
    //         this.HODIntervalData = { ...stockInterval };
    //     } else if (stockInterval.high > this.HODIntervalData.high) {
    //         this.HODIntervalData = { ...stockInterval };
    //     }
    // }

    // private monitorLOD(stockInterval: IQuoteFullIntervalData) {
    //     if (this.interval === 0) {
    //         this.LODIntervalData = { ...stockInterval };
    //     } else if (stockInterval.low < this.LODIntervalData.low) {
    //         this.LODIntervalData = { ...stockInterval };
    //     }
    // }

    // public verifySignal(quoteInterval: IQuoteFullIntervalData, signalVerifiedReason: SignalVerificationReasonEnum) {
    //     if (!this.signalVerified[signalVerifiedReason]) {
    //         this.signalVerified[signalVerifiedReason] = { ...quoteInterval };

    //         logger.debug('--------------------------------------------------------------------');
    //         logger.debug(
    //             'SMA20: ' +
    //                 this.quoteMetadata.SMA20.didOpenOboveSMA +
    //                 ' ,SMA10:' +
    //                 this.quoteMetadata.SMA10.didOpenOboveSMA +
    //                 ' ,SMA5:' +
    //                 this.quoteMetadata.SMA5.didOpenOboveSMA
    //         );
    //         Object.keys(this.signalVerified).forEach((key, index) => {
    //             let buyMessage: string;

    //             buyMessage =
    //                 '*** ' +
    //                 index +
    //                 ' )' +
    //                 this.quote +
    //                 ' Signal Verification  at ' +
    //                 //@ts-ignore
    //                 moment(this.signalVerified[key].timeIsrael).format('HH:mm:ss') +
    //                 ' - Reason: ' +
    //                 key;

    //             pushed.sendPushMessage(buyMessage);
    //             logger.debug(buyMessage);
    //         });
    //         logger.debug('--------------------------------------------------------------------');
    //     }
    // }

    // private MonitorHighVolumeMovement(quoteInterval: IQuoteFullIntervalData) {
    //     if (this.interval >= 2 && this.interval < 71) {
    //         if (this.isExtremeVolume()) {
    //             this.verifySignal(quoteInterval, SignalVerificationReasonEnum.MULTIPLE_HIGH_AVERAGE_VOLUME);
    //         }
    //         if (this.isSuperExtremeVolumeInterval(quoteInterval) && quoteUtiles.isCandleBullish(quoteInterval)) {
    //             this.verifySignal(quoteInterval, SignalVerificationReasonEnum.SUPER_VOLUME_INTERVAL);
    //         } else if (this.isAsFirstVolume(quoteInterval) && quoteUtiles.isCandleBullish(quoteInterval)) {
    //             this.verifySignal(quoteInterval, SignalVerificationReasonEnum.AS_FIRST_VOLUME_INTERVAL);
    //         }
    //     }
    // }

    // private calculatePercentageChange(stockIntervalStart: IQuoteFullIntervalData, stockIntervalEnd: IQuoteFullIntervalData): number {
    //     return +(((stockIntervalStart.close - stockIntervalEnd.close) / stockIntervalStart.close) * -100).toFixed(2);
    // }
}
