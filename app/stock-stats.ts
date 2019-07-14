import moment from "moment-timezone";

import * as environmentConfig from "./config/environment.Config.json";
import * as pushed from "./pushed";
import { getCurrentTradingDay, convertAlphaVantageFormat } from "./utils/utils.js";

import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME, PERCENTAGE_CHANGE_THRESHOLD } from "./config/globals.config";
import {  IAlphaVantageIntervals, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { BuyDirectionEnum } from "./models/enums";
import { logger } from "./config/winston.config.js";

export class StockStats {
    private quote: string;
    private volumeSum: number = 0;
    private interval: number = 0;
    private volumeInterval: number = 0;
    private avg: number = 0;
    private todayDate: string;
    private stockIntervals: IStockFullIntervalData[] = [];


    private didBuy : boolean = false;
    private isInBuyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private isInBreakOutOrDown: BuyDirectionEnum = BuyDirectionEnum.NONE;
    private volumeChangeIntervalData: IStockFullIntervalData = {} as IStockFullIntervalData;
    private HODIntevalData:IStockFullIntervalData = {} as IStockFullIntervalData;
    private LODIntevalData:IStockFullIntervalData = {} as IStockFullIntervalData;
    private boughtIntervalData:IStockFullIntervalData = {} as IStockFullIntervalData;
    private ratioPower: number = 0 ;
    private percentageChange: number = 0;

    constructor(quote: string, todayDate: string= "") {
        this.quote = quote;
        if (todayDate) {
            this.todayDate = todayDate;
        } else {
            this.todayDate = getCurrentTradingDay();
        }
    }

    public InitializeStockData(quoteIntervals: IAlphaVantageIntervals ) {

        this.InitializeStockIntervalsSoFar(quoteIntervals);

        this.stockIntervals.forEach((stockInterval) => {
            this.recordNewStockInterval(stockInterval);
        });
    }

    public recordNewStockInterval(stockInterval: IStockFullIntervalData, isLive: boolean = false) {

        this.composeAndPrintCurrentIntervalStats(stockInterval, isLive);
        this.calculateAverageVolume(stockInterval);
        this.monitorHODBreakout(stockInterval);
        this.monitorLODBreakdown(stockInterval);
        this.composeAndPrintBuyMessage(stockInterval);
        if (stockInterval.time.getHours() === 23 && this.didBuy) {
            logger.debug("*** " + this.quote + " Ended with " +this.calculatePercentageChange( this.boughtIntervalData, stockInterval) + "%");
        }
        if (isLive) {
            this.stockIntervals.push(stockInterval);
        }

        this.interval++;

    }

    private InitializeStockIntervalsSoFar(quoteIntervals: IAlphaVantageIntervals) {
        let intervalKeys = Object.keys(quoteIntervals).filter( (key) => key.includes(this.todayDate));

        if ( intervalKeys.length > 0) {
            // patch fix to handles a bug - different behavior between real data and mock
            if (intervalKeys[0].includes("16:00:00") || !intervalKeys[0].includes("09:35:00") ) {
                intervalKeys = intervalKeys.reverse();
            }

            intervalKeys.forEach((key) => {
                if (key.includes(this.todayDate)) {
                this.stockIntervals.push( convertAlphaVantageFormat(quoteIntervals[key], key)) ;
                }
             });
        }
    }

    private calculateAverageVolume(stockInterval: IStockFullIntervalData) {
        if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
            this.volumeSum += stockInterval.volume;
            this.volumeInterval++;
            this.avg = this.volumeSum / this.volumeInterval;

            if (this.didPassVolumeThreshold( stockInterval )) {
                const currentBuyDirection = this.getBuyDirection(stockInterval);
                const currentRatioPower = this.getVolumeRatioPower(stockInterval.volume);

                if (!this.isInBuyDirection) {
                    if (currentBuyDirection !== BuyDirectionEnum.NONE) {
                        this.isInBuyDirection = currentBuyDirection;
                        this.volumeChangeIntervalData = {...stockInterval };
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

    private monitorHODBreakout( stockInterval: IStockFullIntervalData) {
        if (this.interval === 0) {
            this.HODIntevalData = {...stockInterval };
        } else {
            if (stockInterval.close > this.HODIntevalData.high && !this.isInBreakOutOrDown) {
                this.HODIntevalData = {...stockInterval };
                if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
                    this.isInBreakOutOrDown = BuyDirectionEnum.CALL;
                }
            }
        }
    }

    private monitorLODBreakdown( stockInterval: IStockFullIntervalData) {
        if (this.interval === 0) {
            this.LODIntevalData = {...stockInterval };
        } else {
            if (stockInterval.close < this.LODIntevalData.low && !this.isInBreakOutOrDown) {
                this.LODIntevalData = {...stockInterval };
                if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME && !this.isInBreakOutOrDown) {
                    this.isInBreakOutOrDown = BuyDirectionEnum.PUT;
                }
            }
        }
    }

    private composeAndPrintBuyMessage(stockInterval: IStockFullIntervalData) {
        if (!this.didBuy && this.isInBreakOutOrDown === this.isInBuyDirection && this.isInBuyDirection!==BuyDirectionEnum.NONE) {
            this.boughtIntervalData = {...stockInterval };

            let breakInterval: IStockFullIntervalData = {} as IStockFullIntervalData;

            if (this.isInBreakOutOrDown === BuyDirectionEnum.CALL) {
                breakInterval = this.HODIntevalData;
            } else if (this.isInBreakOutOrDown === BuyDirectionEnum.PUT) {
                breakInterval = this.LODIntevalData;
            }

            const today = moment().isoWeekday();
            const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

            //+ + "buy "+ BuyDirectionEnum[this.isInBuyDirection] + "S of the " + nextFridayDate +
            const buyMessage = "*** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] +" Mode  at " +   moment(stockInterval.time).format("HH:mm:ss")
            +'\n,'+ moment(this.volumeChangeIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)")+")Volume: Power=" +(this.ratioPower * 100).toFixed(2) + "%, Change=" + this.percentageChange + "%"
            +'\n'+ moment(breakInterval.time).format("HH:mm:ss(MMMM Do YYYY)")+") Break Interval time"

            pushed.sendPushMessage(buyMessage);
            logger.debug(buyMessage);

            this.didBuy = true;
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

    private composeAndPrintCurrentIntervalStats(stockInterval: IStockFullIntervalData, isLive:boolean) {

        
        let stats = {quote: this.quote, interval: moment(stockInterval.time).format("HH:mm:ss") , ...stockInterval,
                        intervalNumber: this.interval, volumeIntervalNumber: this.volumeInterval ,
                        volumeSum: this.volumeSum, avg: this.avg } as any;

        if (isLive) {
            stats = {isLive:  moment(new Date()).format("HH:mm:ss") ,...stats } ;
        }
         logger.debug ( JSON.stringify(stats) );
    }

    private didPassVolumeThreshold(stockInterval: IStockFullIntervalData): boolean {
        if (this.isTradeClosingTime(stockInterval)) {
            return false;
        }

        const {volume} = stockInterval;
        if ( volume > this.avg * VOLUME_THRESHOLD_ALARM && !this.isInBuyDirection) {
           const percentageIntervalChange =  this.getPercentageChange(stockInterval);
           if (this.quote=="AMZN" || this.quote=="Googl" || this.quote=="CMG") {
               return true;
           }
           else {
            return (percentageIntervalChange > PERCENTAGE_CHANGE_THRESHOLD ); 
          }
        } else {
            return false;
        }
    }

    private isTradeClosingTime(stockInterval: IStockFullIntervalData): boolean {
        return (stockInterval.time.getHours() >= 22 && stockInterval.time.getMinutes() >= 45 || stockInterval.time.getHours() === 23);
    }

    private getPercentageChange(stockInterval: IStockFullIntervalData): number {
        const percentage = (Math.abs(stockInterval.open - stockInterval.close) / stockInterval.open) * 100 ;

        return +percentage.toFixed(2);
    }
    
    private calculatePercentageChange(stockIntervalStart: IStockFullIntervalData, stockIntervalEnd: IStockFullIntervalData): number {
             return +(((stockIntervalStart.close-stockIntervalEnd.close) / stockIntervalStart.close) * -100).toFixed(2);
    }

    private getVolumeRatioPower(volume: number): number {
        const ratio = volume / this.avg;
        return +ratio.toFixed(2);
    }
    private getBuyDirection(stockInterval: IStockFullIntervalData): BuyDirectionEnum {
        if (stockInterval.close > stockInterval.open) {
            // checks if inverted hammer - if so , there is hesitation - don't buy Call
            if ((stockInterval.high - stockInterval.close) > (stockInterval.close - stockInterval.open)) {
                return BuyDirectionEnum.NONE;
            }
            return BuyDirectionEnum.CALL;
        } else if (stockInterval.open > stockInterval.close) {
            // checks if hammer - if so , there is hesitation - don't buy put 
            if ((stockInterval.close - stockInterval.low) > (stockInterval.open - stockInterval.close)) {
                return BuyDirectionEnum.NONE;
            }
            return BuyDirectionEnum.PUT;
        } else {
            return BuyDirectionEnum.NONE;
        }
    }

}
