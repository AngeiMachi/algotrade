import moment from "moment-timezone";
import * as _ from "lodash";

import * as pushed from "./proxy/pushed-api";
import * as quoteUtiles from "./utils/quote-utils";

import { IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from "./models/stock-interval-data.model";
import { BuyDirectionEnum, buyReasonEnum } from "./models/enums";
import { logger } from "./config/winston.config.js";
import { minuteDifference } from "./utils/general.js";

export class QuoteStats {

    private quote: string;
    private quoteMetadata = {} as IQuoteMetadata;

    private volumeSum: number = 0;
    private interval: number = 0;
    private volumeInterval: number = 0;
    private averageVolume: number = 0;
    private todayDate: string;
    private quoteIntervals: IQuoteFullIntervalData[] = [];

    private allowedBuyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private didTouchSMA: boolean = false;
    private didBuy: boolean = false;
    private didSell: boolean = false;
    private didSellWithLoss: boolean = false;
    private isDirty: boolean = false; // flag to know if bought once
    private strengthOf5MA: number = 0;
    private isInBuyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;

    private HODIntervalData = {} as IQuoteFullIntervalData;
    private LODIntervalData = {} as IQuoteFullIntervalData;
    private boughtIntervalData = {} as IQuoteFullIntervalData;
    private soldIntervalData = {} as IQuoteFullIntervalData;


    constructor(quote: string, todayDate: string = "") {
        this.quote = quote;
        if (todayDate) {
            this.todayDate = todayDate;
        } else {
            this.todayDate = quoteUtiles.getCurrentTradingDate();
        }
    }

    public initializeStockData(quoteIntervals: IQuoteIntervals, quoteMetadata: IQuoteMetadata): number {
        let profitLossAccount: number = 0;

        this.quoteMetadata = quoteMetadata;

        this.initializeStockIntervalsSoFar(quoteIntervals);

        this.quoteIntervals.forEach((stockInterval) => {
            profitLossAccount += this.recordNewStockInterval(stockInterval);
        });

        return profitLossAccount;
    }

    public recordNewStockInterval(stockInterval: IQuoteFullIntervalData, isLive: boolean = false): number {

        this.composeAndPrintCurrentIntervalStats(stockInterval, isLive);
        this.monitorHOD(stockInterval);
        this.monitorLOD(stockInterval);
        this.calculateAverageVolume(stockInterval);
        this.calculateMovingAverage(stockInterval);
        this.checkToSell(stockInterval);
        
        this.decideAllowedByDirectionForToday(stockInterval);
        this.checkToKnowIfReached5SMA(stockInterval);
        this.buyOnHighVolumeMovement(stockInterval);

        if (isLive) {
            this.quoteIntervals.push(stockInterval);
        }
        this.interval++;

        if (!isLive && this.didBuy && this.interval === 77) {
            logger.debug("*** " + this.quote + " Ended with " +
                this.calculatePercentageChange(this.boughtIntervalData, this.soldIntervalData) + "%");
            if (this.didSellWithLoss) {
                logger.debug("*** " + this.quote + " Could of Ended with " +
                    this.calculatePercentageChange(this.boughtIntervalData, stockInterval) + "%");
            }
            return this.calculateLossProfit();
        }
        return 0;
    }

    calculateMovingAverage(stockInterval: IQuoteFullIntervalData) {

        // volumeWeight = this.averageVolume/this.quoteMetadata.average5Minute3Month ;
        if (!this.didBuy) {
            if (this.allowedBuyDirection === BuyDirectionEnum.CALL) {
                this.quoteMetadata.SMA5.today = quoteUtiles.calculateMovingAverage(this.quoteMetadata.fullYearDailyHistory, this.todayDate, 5, this.HODIntervalData);
            }
            if (this.allowedBuyDirection === BuyDirectionEnum.PUT) {
                this.quoteMetadata.SMA5.today = quoteUtiles.calculateMovingAverage(this.quoteMetadata.fullYearDailyHistory, this.todayDate, 5, this.LODIntervalData);
            }

            this.strengthOf5MA = ((this.quoteMetadata.SMA5.today) - this.quoteMetadata.SMA5.previousDay);
        }

    }

    private initializeStockIntervalsSoFar(quoteIntervals: IQuoteIntervals) {

        let intervalKeys = Object.keys(quoteIntervals).filter((key) => key.includes(this.todayDate));

        if (intervalKeys.length > 0) {
            // patch fix to handles a bug - different behavior between real data and mock
            if (intervalKeys[0].includes("16:00:00") || !intervalKeys[0].includes("09:35:00")) {
                intervalKeys = intervalKeys.reverse();
            }

            intervalKeys.forEach((key) => {
                if (key.includes(this.todayDate)) {
                    this.quoteIntervals.push(quoteIntervals[key]);
                }
            });
        }
    }

    private calculateAverageVolume(stockInterval: IQuoteFullIntervalData) {
        this.volumeSum += stockInterval.volume;
        this.averageVolume = this.volumeSum / (this.interval + 1);
    }
    private isExtremeVolume(): boolean {
        if ((((this.quoteMetadata.averageDailyVolume10Day as number) / 78) * 1.8) <= (this.averageVolume)) {
            return true;
        }

        return false;
    }

    private isSuperExtremeVolumeInterval(quoteInterval: IQuoteFullIntervalData): boolean {
        if ((this.quoteMetadata.averageDailyVolume10Day) <= (quoteInterval.volume * 4)) {
            return true;
        }
        return false;
    }

    private isAsFirstVolume(quoteInterval: IQuoteFullIntervalData) {
        if (quoteInterval.volume * 1.2 >= this.quoteIntervals[0].volume) {
            if ((((this.quoteMetadata.averageDailyVolume3Month as number) / 78) * 1.5) <= quoteInterval.volume) {
                return true;
            }
        }
    }

    private monitorHOD(stockInterval: IQuoteFullIntervalData) {
        if (this.interval === 0) {
            this.HODIntervalData = { ...stockInterval };
        } else if (!this.didBuy && stockInterval.high > this.HODIntervalData.high) {
            this.HODIntervalData = { ...stockInterval };
        }
    }

    private monitorLOD(stockInterval: IQuoteFullIntervalData) {
        if (this.interval === 0) {
            this.LODIntervalData = { ...stockInterval };
        } else if (!this.didBuy && stockInterval.low < this.LODIntervalData.low) {
            this.LODIntervalData = { ...stockInterval };
        }
    }

    private decideAllowedByDirectionForToday(quoteInterval: IQuoteFullIntervalData) {
        if (this.interval === 0) {

            this.strengthOf5MA = this.quoteMetadata.SMA5.today - this.quoteMetadata.SMA5.previousDay;

            if (this.strengthOf5MA > 0.2) {
                if (this.quoteMetadata.SMA5.today <= quoteInterval.open + (this.strengthOf5MA / 2)) {
                    this.allowedBuyDirection = BuyDirectionEnum.CALL;
                } else {
                    this.allowedBuyDirection = BuyDirectionEnum.NONE;
                }
            } else if (this.strengthOf5MA < -0.2) {
                if (this.quoteMetadata.SMA5.today >= quoteInterval.open + (this.strengthOf5MA / 2)) {
                    this.allowedBuyDirection = BuyDirectionEnum.PUT;
                } else {
                    this.allowedBuyDirection = BuyDirectionEnum.NONE;
                }
            } else {
                this.allowedBuyDirection = BuyDirectionEnum.NONE;
            }
        }
    }

    private checkToKnowIfReached5SMA(quoteInterval: IQuoteFullIntervalData) {
        if (!this.didTouchSMA) {
            // const vector =  (this.quoteIntervals[0].open / this.strengthOf5MA ) * 100;
            const vector = 0;

            if (this.allowedBuyDirection === BuyDirectionEnum.CALL &&
                ((this.LODIntervalData.low - ((this.strengthOf5MA) + vector)) <= this.quoteMetadata.SMA5.today)) {
                this.didTouchSMA = true;
            } else if (this.allowedBuyDirection === BuyDirectionEnum.PUT &&
                ((this.HODIntervalData.high - ((this.strengthOf5MA) + vector) ) >= this.quoteMetadata.SMA5.today)) {
                this.didTouchSMA = true;
            }
        }
    }

    private buyQuote(quoteInterval: IQuoteFullIntervalData, buyReason: buyReasonEnum) {
        if (!this.didBuy) {

            let buyMessage: string;

            // this.isInBuyDirection = this.getBuyDirection(quoteInterval);
            this.isInBuyDirection = this.allowedBuyDirection;
            if (true) {
                this.boughtIntervalData = { ...quoteInterval };
                this.didBuy = true;
                this.isDirty = true;

                buyMessage = "*** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] +
                    " Mode  at " + moment(quoteInterval.timeIsrael).format("HH:mm:ss") + " - Reason: " + buyReason;
            } else {

                buyMessage = "CANCELED *** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] +
                    " Mode  at " + moment(quoteInterval.timeIsrael).format("HH:mm:ss");
            }
            pushed.sendPushMessage(buyMessage);
            logger.debug(buyMessage);
        }
    }

    private checkToSell(quoteInterval: IQuoteFullIntervalData) {
        if (this.didBuy && !this.didSell) {

            // if before close - sell
            if (this.interval === 76) {
                this.soldIntervalData = { ...quoteInterval };
                this.didSell = true;
            }
            else if ((this.isInBuyDirection === BuyDirectionEnum.CALL) &&
                (quoteInterval.low < this.quoteMetadata.SMA5.today - (this.strengthOf5MA)) &&
                (minuteDifference(this.boughtIntervalData.timeIsrael, quoteInterval.timeIsrael) > 15) &&
                (quoteInterval.close < this.boughtIntervalData.low) &&
                (quoteInterval.close < this.LODIntervalData.low)) {

                this.soldIntervalData = { ...quoteInterval };
                this.didSell = true;
                this.didSellWithLoss = true;
                logger.debug("CALLS NOT WORKING - SOLD WITH LOSS AT " + moment(quoteInterval.timeIsrael).format("HH:mm:ss"));

            } else if ((this.isInBuyDirection === BuyDirectionEnum.PUT) &&
                (quoteInterval.high > this.quoteMetadata.SMA5.today - (this.strengthOf5MA)) &&
                (minuteDifference(this.boughtIntervalData.timeIsrael, quoteInterval.timeIsrael) > 15) &&
                (quoteInterval.close > this.boughtIntervalData.high) &&
                (quoteInterval.close > this.HODIntervalData.high)) {

                this.soldIntervalData = { ...quoteInterval };
                this.didSell = true;
                this.didSellWithLoss = true;
                logger.debug("PUTS NOT WORKING - SOLD WITH LOSS AT " + moment(quoteInterval.timeIsrael).format("HH:mm:ss"));
            }
        }
    }

    private buyOnHighVolumeMovement(quoteInterval: IQuoteFullIntervalData) {
        if (!this.didBuy && this.interval >= 2 && this.interval < 71) {
            if (this.didTouchSMA) {
                if (this.isExtremeVolume()) {
                    this.buyQuote(quoteInterval, buyReasonEnum.MULTIPLE_HIGH_AVERAGE_VOLUME);
                }
            }
            if (this.isSuperExtremeVolumeInterval(quoteInterval)) {
                this.buyQuote(quoteInterval, buyReasonEnum.SUPER_VOLUME_INTERVAL);
            } else if (this.isAsFirstVolume(quoteInterval)) {
                this.buyQuote(quoteInterval, buyReasonEnum.AS_FIRST_VOLUME_INTERVAL);
            }
        }
    }

    private calculateLossProfit(): number {
        if (this.isInBuyDirection === BuyDirectionEnum.CALL) {
            return +(this.soldIntervalData.close - this.boughtIntervalData.close).toFixed(2);
        } else if (this.isInBuyDirection === BuyDirectionEnum.PUT) {
            return +(this.boughtIntervalData.close - this.soldIntervalData.close).toFixed(2);
        } else {
            return 0;
        }
    }

    private composeAndPrintCurrentIntervalStats(stockInterval: IQuoteFullIntervalData, isLive: boolean) {
        let stats = {
            quote: this.quote, interval: moment(stockInterval.timeIsrael).format("HH:mm:ss"), ...stockInterval,
            intervalNumber: this.interval, volumeIntervalNumber: this.volumeInterval,
            volumeSum: this.volumeSum, avg: this.averageVolume,
        } as any;

        if (isLive) {
            stats = { isLive: moment(new Date()).format("HH:mm:ss"), ...stats };
        }
        logger.debug(JSON.stringify(stats));
    }

    private calculatePercentageChange(stockIntervalStart: IQuoteFullIntervalData, stockIntervalEnd: IQuoteFullIntervalData): number {
        return +(((stockIntervalStart.close - stockIntervalEnd.close) / stockIntervalStart.close) * -100).toFixed(2);
    }



}
