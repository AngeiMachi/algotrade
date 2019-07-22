import moment from "moment-timezone";

import * as environmentConfig from "./config/environment.Config.json";
import * as pushed from "./pushed";
import { getCurrentTradingDay, convertAlphaVantageFormat } from "./utils/utils.js";

import { VOLUME_THRESHOLD_ALARM, MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME, PERCENTAGE_CHANGE_THRESHOLD } from "./config/globals.config";
import { IAlphaVantageIntervals, IQouteFullIntervalData, IQouteIntervals, IQouteMetadata } from "./models/stock-interval-data.model";
import { BuyDirectionEnum } from "./models/enums";
import { logger } from "./config/winston.config.js";

export class QuoteStats {
    private debugAtDate:string = "2019-05-09";

    private quote: string;
    private quoteMetadata = {} as IQouteMetadata;

    private volumeSum: number = 0;
    private interval: number = 0;
    private volumeInterval: number = 0;
    private averageVolume: number = 0;
    private todayDate: string;
    private quoteIntervals: IQouteFullIntervalData[] = [];


    private allowedBuyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private didTouchSMA: boolean = false;
    private didBuy: boolean = false;
    private didSell: boolean = false;
    private isDirty: boolean = false; // flag to know if bought once 
    private strengthOf5MA:number = 0;
    private isInBuyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private isInBreakOutOrDown: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private volumeChangeIntervalData = {} as IQouteFullIntervalData;
    private HODIntevalData = {} as IQouteFullIntervalData;
    private LODIntevalData = {} as IQouteFullIntervalData;
    private boughtIntervalData = {} as IQouteFullIntervalData;
    private soldIntervalData = {} as IQouteFullIntervalData;
    private ratioPower: number = 0;
    private percentageChange: number = 0;

    constructor(quote: string, todayDate: string = "") {
        this.quote = quote;
        if (todayDate) {
            this.todayDate = todayDate;
        } else {
            this.todayDate = getCurrentTradingDay();
        }
    }

    public initializeStockData(quoteIntervals: IQouteIntervals, quoteMetadata: IQouteMetadata): number {
        let profitLossAccount: number = 0;

        this.quoteMetadata = quoteMetadata;

        this.InitializeStockIntervalsSoFar(quoteIntervals);

        this.quoteIntervals.forEach((stockInterval) => {
            profitLossAccount += this.recordNewStockInterval(stockInterval);
        });

        return profitLossAccount;
    }

    public recordNewStockInterval(stockInterval: IQouteFullIntervalData, isLive: boolean = false): number {

        //this.composeAndPrintCurrentIntervalStats(stockInterval, isLive);
        
        //this.monitorHODBreakout(stockInterval);
        //this.monitorLODBreakdown(stockInterval);
        //this.composeAndPrintBuyMessage(stockInterval);
        this.calculateAverageVolume(stockInterval);
        this.decideAllowedByDirectionForToday(stockInterval);
        this.checkToKnowIfReached5SMA(stockInterval);
        this.buyOnHighVolumeMovement(stockInterval);
        this.checkToSell(stockInterval);
        if (isLive) {
            this.quoteIntervals.push(stockInterval);
        }
        this.interval++;

        if (!isLive && this.didBuy && this.interval == 77) {
            logger.debug("*** " + this.quote + " Ended with " + this.calculatePercentageChange(this.boughtIntervalData, stockInterval) + "%");
            return this.calculateLossProfit();
        }
        return 0;
    }

    private InitializeStockIntervalsSoFar(quoteIntervals: IQouteIntervals) {

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

    private calculateAverageVolume(stockInterval: IQouteFullIntervalData) {
            this.volumeSum += stockInterval.volume;
            this.averageVolume = this.volumeSum / this.interval+1;
    }
    private isExtremeVolume() : boolean {
        if ((((this.quoteMetadata.averageDailyVolume10Day as number)/78)*(this.interval+1))<=(this.averageVolume*2)) {
            return true;
        } 

        return false;    
    }

    private calculateAverageVolume2(stockInterval: IQouteFullIntervalData) {
        if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
            this.volumeSum += stockInterval.volume;
            this.volumeInterval++;
            this.averageVolume = this.volumeSum / this.volumeInterval;

            if (this.didPassVolumeThreshold(stockInterval)) {
                const currentBuyDirection = this.getBuyDirection(stockInterval);
                const currentRatioPower = this.getVolumeRatioPower(stockInterval.volume);

                if (!this.isInBuyDirection) {
                    if (currentBuyDirection !== BuyDirectionEnum.NONE) {
                        this.isInBuyDirection = currentBuyDirection;
                        this.volumeChangeIntervalData = { ...stockInterval };
                        this.ratioPower = currentRatioPower;
                        this.percentageChange = this.getPercentageChange(stockInterval);
                    }
                } else if (this.isInBuyDirection) {
                    if (currentBuyDirection !== this.isInBuyDirection && currentBuyDirection !== BuyDirectionEnum.NONE) {
                        this.composeAndPrintSellMessage();
                    }
                }
            }
        }
    }

    private monitorHODBreakout(stockInterval: IQouteFullIntervalData) {
        if (this.interval === 0) {
            this.HODIntevalData = { ...stockInterval };
        } else {
            if (stockInterval.close > this.HODIntevalData.high && !this.isInBreakOutOrDown) {
                this.HODIntevalData = { ...stockInterval };
                if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
                    this.isInBreakOutOrDown = BuyDirectionEnum.CALL;
                }
            }
        }
    }

    private monitorLODBreakdown(stockInterval: IQouteFullIntervalData) {
        if (this.interval === 0) {
            this.LODIntevalData = { ...stockInterval };
        } else {
            if (stockInterval.close < this.LODIntevalData.low && !this.isInBreakOutOrDown) {
                this.LODIntevalData = { ...stockInterval };
                if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME && !this.isInBreakOutOrDown) {
                    this.isInBreakOutOrDown = BuyDirectionEnum.PUT;
                }
            }
        }
    }

    private composeAndPrintBuyMessage(stockInterval: IQouteFullIntervalData) {
        if (!this.didBuy && this.isInBreakOutOrDown === this.isInBuyDirection && this.isInBuyDirection !== BuyDirectionEnum.NONE) {
            this.boughtIntervalData = { ...stockInterval };

            let breakInterval: IQouteFullIntervalData = {} as IQouteFullIntervalData;

            if (this.isInBreakOutOrDown === BuyDirectionEnum.CALL) {
                breakInterval = this.HODIntevalData;
            } else if (this.isInBreakOutOrDown === BuyDirectionEnum.PUT) {
                breakInterval = this.LODIntevalData;
            }

            const today = moment().isoWeekday();
            const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

            //+ + "buy "+ BuyDirectionEnum[this.isInBuyDirection] + "S of the " + nextFridayDate +
            const buyMessage = "*** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] + " Mode  at " + moment(stockInterval.time).format("HH:mm:ss")
                + '\n,' + moment(this.volumeChangeIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)") + ")Volume: Power=" + (this.ratioPower * 100).toFixed(2) + "%, Change=" + this.percentageChange + "%"
                + '\n' + moment(breakInterval.time).format("HH:mm:ss(MMMM Do YYYY)") + ") Break Interval time"

            pushed.sendPushMessage(buyMessage);
            logger.debug(buyMessage);

            this.didBuy = true;
        }
    }

    private decideAllowedByDirectionForToday(quoteInterval: IQouteFullIntervalData) {
        if (this.interval === 0) {
            const today5SMA = +this.quoteMetadata.SMA5["Technical Analysis: SMA"][this.todayDate].SMA;
            const dayBefore5MA =  this.getDayBefore5MA();
            this.strengthOf5MA = today5SMA - dayBefore5MA;
            if (this.strengthOf5MA>0.2) {
                if (today5SMA <= quoteInterval.open+( this.strengthOf5MA/2)) {
                    this.allowedBuyDirection = BuyDirectionEnum.CALL;
                }
                else {
                    this.allowedBuyDirection = BuyDirectionEnum.NONE;
                }
            } else if (this.strengthOf5MA<-0.2) {
                if (today5SMA >= quoteInterval.open - ( this.strengthOf5MA/2)) {
                    this.allowedBuyDirection = BuyDirectionEnum.PUT;
                }
                else {
                    this.allowedBuyDirection = BuyDirectionEnum.NONE;
                }
            }
            else {
                this.allowedBuyDirection = BuyDirectionEnum.NONE;
            }
        }
    }

    private checkToKnowIfReached5SMA(quoteInterval: IQouteFullIntervalData) {
        if (!this.didTouchSMA) {
            const today5SMA = +this.quoteMetadata.SMA5["Technical Analysis: SMA"][this.todayDate].SMA;

            if (this.allowedBuyDirection === BuyDirectionEnum.CALL && ((quoteInterval.low - (this.strengthOf5MA/2)) <= today5SMA)) {
                this.didTouchSMA = true;
            } else if (this.allowedBuyDirection === BuyDirectionEnum.PUT && ((quoteInterval.high + (this.strengthOf5MA/2)) >= today5SMA)) {
                this.didTouchSMA = true;
            }
        }
    }

    private buyQuote(quoteInterval: IQouteFullIntervalData) {
        if (!this.didBuy) {

            let buyMessage: string;

            //this.isInBuyDirection = this.getBuyDirection(quoteInterval);
            this.isInBuyDirection = this.allowedBuyDirection;
            if (this.isInBuyDirection !== BuyDirectionEnum.NONE) {
                this.boughtIntervalData = { ...quoteInterval };
                this.didBuy = true;
                this.isDirty = true;

                buyMessage = "*** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] + " Mode  at " + moment(quoteInterval.time).format("HH:mm:ss");
            }
            else {
                buyMessage = "CANCELED *** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] + " Mode  at " + moment(quoteInterval.time).format("HH:mm:ss");
            }
            pushed.sendPushMessage(buyMessage);
            logger.debug(buyMessage);
        }
    }

    private checkToSell(quoteInterval: IQouteFullIntervalData) {
        if (this.didBuy && this.didSell === false) {
            if (this.interval == 76) {
                this.soldIntervalData = { ...quoteInterval };
                this.didSell = true;
            }
        }
    }

    private buyOnHighVolumeMovement(quoteInterval: IQouteFullIntervalData) {
        if (!this.didBuy && this.interval >= 2 && this.interval < 71 && this.didTouchSMA) {
            if (quoteInterval.volume * 1.2 >= this.quoteIntervals[0].volume) {
                this.buyQuote(quoteInterval);
            } else if (this.isExtremeVolume()) {
                this.buyQuote(quoteInterval);
            }
        }
    }



    private calculateLossProfit(): number {
        if (this.isInBuyDirection === BuyDirectionEnum.CALL) {
            return +(this.soldIntervalData.close - this.boughtIntervalData.close).toFixed(2);
        } else if (this.isInBuyDirection === BuyDirectionEnum.PUT) {
            return +(this.boughtIntervalData.close - this.soldIntervalData.close).toFixed(2);
        }
        else {
            return 0;
        }
    }

    private composeAndPrintBuyMessageBasedOnHOD() {
        const today = moment().isoWeekday();
        const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

        const buyMessage = "*** " + this.quote + " Was bought by breakout confirmation "
            + moment(this.HODIntevalData.time).format("HH:mm:ss(MMMM Do YYYY)")
            + " Can buy Calls of the " + nextFridayDate;

        pushed.sendPushMessage(buyMessage);
        logger.debug(buyMessage);
    }

    private composeAndPrintSellMessage() {
        const today = moment().isoWeekday();
        const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

        logger.debug("*** " + this.quote + " *** passed threshold by " + this.ratioPower * 100 + "% at "
            + moment(this.volumeChangeIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)")
            + "\n Should Sell " + BuyDirectionEnum[this.isInBuyDirection] + "S of the "
            + nextFridayDate + "due to opposite direction volume volatility");
    }

    private composeAndPrintCurrentIntervalStats(stockInterval: IQouteFullIntervalData, isLive: boolean) {
        let stats = {
            quote: this.quote, interval: moment(stockInterval.time).format("HH:mm:ss"), ...stockInterval,
            intervalNumber: this.interval, volumeIntervalNumber: this.volumeInterval,
            volumeSum: this.volumeSum, avg: this.averageVolume
        } as any;

        if (isLive) {
            stats = { isLive: moment(new Date()).format("HH:mm:ss"), ...stats };
        }
        logger.debug(JSON.stringify(stats));
    }

    private didPassVolumeThreshold(stockInterval: IQouteFullIntervalData): boolean {
        if (this.isTradeClosingTime(stockInterval)) {
            return false;
        }

        const { volume } = stockInterval;
        if (volume > this.averageVolume * VOLUME_THRESHOLD_ALARM && !this.isInBuyDirection) {
            const percentageIntervalChange = this.getPercentageChange(stockInterval);
            if (this.quote == "AMZN" || this.quote == "Googl" || this.quote == "CMG") {
                return true;
            }
            else {
                return (percentageIntervalChange > PERCENTAGE_CHANGE_THRESHOLD);
            }
        } else {
            return false;
        }
    }

    private isTradeClosingTime(stockInterval: IQouteFullIntervalData): boolean {
        return (stockInterval.time.getHours() >= 22 && stockInterval.time.getMinutes() >= 45 || stockInterval.time.getHours() === 23);
    }

    private getPercentageChange(stockInterval: IQouteFullIntervalData): number {
        const percentage = (Math.abs(stockInterval.open - stockInterval.close) / stockInterval.open) * 100;

        return +percentage.toFixed(2);
    }

    private calculatePercentageChange(stockIntervalStart: IQouteFullIntervalData, stockIntervalEnd: IQouteFullIntervalData): number {
        return +(((stockIntervalStart.close - stockIntervalEnd.close) / stockIntervalStart.close) * -100).toFixed(2);
    }

    private getVolumeRatioPower(volume: number): number {
        const ratio = volume / this.averageVolume;
        return +ratio.toFixed(2);
    }
    private getBuyDirection(stockInterval: IQouteFullIntervalData): BuyDirectionEnum {
        if (stockInterval.close > stockInterval.open) {
            // checks if inverted hammer - if so , there is hesitation - don't buy Call
            // if ((stockInterval.high - stockInterval.close) > (stockInterval.close - stockInterval.open)) {
            //     return BuyDirectionEnum.NONE;
            // }
            return BuyDirectionEnum.CALL;
        } else if (stockInterval.open > stockInterval.close) {
            // checks if hammer - if so , there is hesitation - don't buy put 
            // if ((stockInterval.close - stockInterval.low) > (stockInterval.open - stockInterval.close)) {
            //     return BuyDirectionEnum.NONE;
            // }
            return BuyDirectionEnum.PUT;
        } else {
            return BuyDirectionEnum.NONE;
        }
    }

    private getDayBefore5MA() : number{
        let dayBefore5MA;
        let dayBefore = this.todayDate;
        while (!dayBefore5MA) {
            dayBefore = moment(dayBefore).subtract(1, "days").format("YYYY-MM-DD");
            if (this.quoteMetadata.SMA5["Technical Analysis: SMA"][dayBefore]) {
                dayBefore5MA = +this.quoteMetadata.SMA5["Technical Analysis: SMA"][dayBefore].SMA
            }
        }
        return dayBefore5MA;
    }

}
