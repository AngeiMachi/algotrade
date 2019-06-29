import moment from "moment-timezone";

import * as environmentConfig from "./config/environment.Config.json";
import * as pushed from "./pushed";
import { getCurrentTradingDay, convertAlphaVantageFormat } from "./utils/utils.js";

import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME } from "./config/globals.config";
import {  IAlphaVantageIntervals, IStockFullIntervalData } from "./models/stock-interval-data.model";
import { BuyDirectionEnum } from "./models/enums";

export class StockStats {
    private quote: string;
    private volumeSum: number = 0;
    private interval: number = 0;
    private volumeInterval: number = 0;
    private avg: number = 0;
    private todayDate: string;
    private stockIntervals: IStockFullIntervalData[] = [];

    private isInBuyMode: boolean = false;
    private boughtInterval: IStockFullIntervalData = {} as IStockFullIntervalData;
    private ratioPower: number = 0 ;
    private buyDirection: BuyDirectionEnum = BuyDirectionEnum.NONE;

    constructor(quote: string) {
        this.quote = quote;

        this.todayDate = getCurrentTradingDay();
    }

    public InitializeStockData(quoteIntervals: IAlphaVantageIntervals ) {

        this.InitializeStockIntervalsSoFar(quoteIntervals);

        this.stockIntervals.forEach((stockInterval) => {
            this.recordNewStockInterval(stockInterval);
        });
    }

    public recordNewStockInterval(stockInterval: IStockFullIntervalData) {

        this.calculateAverageVolume(stockInterval);

        this.composeAndPrintCurrentStats(stockInterval);

        this.interval++;

    }

    private InitializeStockIntervalsSoFar(quoteIntervals: IAlphaVantageIntervals) {
        let intervalKeys = Object.keys(quoteIntervals).filter( (key) => key.includes(this.todayDate));

        // patch fix to handles a bug - different behavior between real data and mock
        if (!intervalKeys[0].includes("09:35:00")) {
            intervalKeys = intervalKeys.reverse();
        }

        intervalKeys.forEach((key) => {
            if (key.includes(this.todayDate)) {
              this.stockIntervals.push( convertAlphaVantageFormat(quoteIntervals[key], key)) ;
            }
          });
    }

    private calculateAverageVolume(stockInterval: IStockFullIntervalData) {
        if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
            const {volume} = stockInterval ;
            this.volumeSum += volume;
            this.volumeInterval++;
            this.avg = this.volumeSum / this.volumeInterval;

            if (this.didPassVolumeThreshold( volume )) {
                this.buyDirection = this.getBuyDirection(stockInterval);
                if (this.buyDirection !== BuyDirectionEnum.NONE) {
                    this.boughtInterval = {...stockInterval };
                    this.isInBuyMode = true;
                    this.ratioPower = this.getVolumeRatioPower(volume);

                    this.composeAndPrintBuyMessage();
                }
            }
        }
    }

    private composeAndPrintBuyMessage() {
        const today = moment().isoWeekday();
        const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

        const buyMessage = "*** " + this.quote + " *** passed threshold by " + this.ratioPower * 100 + "% at "
        + moment(this.boughtInterval.time).format("HH:mm:ss(MMMM Do YYYY)")
        + "\nCan buy " + BuyDirectionEnum[this.buyDirection] + "S of the " + nextFridayDate;

        pushed.sendPushMessage(buyMessage);
        console.log(buyMessage);
    }

    private composeAndPrintCurrentStats(stockInterval: IStockFullIntervalData) {

         const stats = {quote: this.quote, interval: moment(stockInterval.time).format("HH:mm:ss") , ...stockInterval,
                        intervalNumber: this.interval, volumeIntervalNumber: this.volumeInterval ,
                        volumeSum: this.volumeSum, avg: this.avg };

         console.log (stats );
    }

    private didPassVolumeThreshold(volume: number): boolean {
        return ( volume > this.avg * VOLUME_THRESHOLD_ALARM && !this.isInBuyMode);
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
