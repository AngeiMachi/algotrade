import moment from "moment-timezone";

import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME } from "./config";
import { IStockIntervalData, IAlphaVantageIntervals, IStockFullIntervalData } from "./models/stock-interval-data.model";
import {BuyDirection} from "./models/enums";

export class StockStats {
    private quote: string;
    private volumeSum: number;
    private interval: number;
    private volumeInterval: number;
    private avg: number;
    private todayDate: string;
    private stockIntervals: IStockFullIntervalData[] = [];


    private isInBuyMode: boolean;
    private boughtInterval: IStockFullIntervalData = {} as IStockFullIntervalData;
    private ratioPower: number;
    private buyDirection: BuyDirection;

    constructor(quote: string) {
        this.quote = quote;
        this.volumeSum = 0;
        this.interval = 0;
        this.volumeInterval = 0;
        this.avg = 0;

        this.isInBuyMode = false;
        this.ratioPower = 0;
        this.buyDirection = BuyDirection.NONE;

        // this.todayDate = moment(new Date()).format("YYYY-MM-DD");
        this.todayDate = "2019-06-26"; // for testing
    }

    public InitializeStockData(quoteIntervals: IAlphaVantageIntervals ) {

        this.InitializeStockIntervalsSoFar(quoteIntervals);

        this.stockIntervals.forEach((stockInterval) => {
            this.recordNewStockInterval(stockInterval);
        });
    }

    public recordNewStockInterval(stockInterval: IStockFullIntervalData) {
        console.log(stockInterval);

        this.calculateAverageVolume(stockInterval);

        this.interval++;

    }

    private InitializeStockIntervalsSoFar(quoteIntervals: IAlphaVantageIntervals) {
        Object.keys(quoteIntervals).reverse().forEach((key) => {
            if (key.includes(this.todayDate)) {
              this.stockIntervals.push(this.convertAlphaVantageFormat(quoteIntervals[key], key)) ;
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
                if (this.buyDirection !== BuyDirection.NONE) {
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

        console.log("*** " + this.quote + " *** passed threshold by " + this.ratioPower * 100 + "% at "
         + moment(this.boughtInterval.time).format("HH:mm:ss(MMMM Do YYYY)")
         + "\nCan buy " + BuyDirection[this.buyDirection] + "S of the " + nextFridayDate);
    }

    private didPassVolumeThreshold(volume: number): boolean {
        return ( volume > this.avg * VOLUME_THRESHOLD_ALARM && !this.isInBuyMode);
    }

    private getVolumeRatioPower(volume: number): number {
        const ratio = volume / this.avg;
        return +ratio.toFixed(2);
    }
    private getBuyDirection(stockInterval: IStockFullIntervalData): BuyDirection {
        if (stockInterval.close > stockInterval.open) {
            // checks if inverted hammer - if so , there is hesitation - don't buy Call
            if ((stockInterval.high - stockInterval.close) > (stockInterval.close - stockInterval.open)) {
                return BuyDirection.NONE;
            }
            return BuyDirection.Call;
        } else if (stockInterval.open > stockInterval.close) {
            // checks if hammer - if so , there is hesitation - don't buy put 
            if ((stockInterval.close - stockInterval.low) > (stockInterval.open - stockInterval.close)) {
                return BuyDirection.NONE;
            }
            return BuyDirection.Put;
        } else {
            return BuyDirection.NONE;
        }
    }

    private convertAlphaVantageFormat(stockIntervalData: IAlphaVantageIntervals, key: string): IStockFullIntervalData {
        const nasdaqTime = moment.tz(key, "America/New_York");
        const israelTime = nasdaqTime.clone().tz("Asia/Jerusalem");

        const convertedStockIntervalData: IStockFullIntervalData = {
            open :  Number(Object.values(stockIntervalData)[0]) ,
            high :  Number(Object.values(stockIntervalData)[1]),
            low :  Number(Object.values(stockIntervalData)[2]),
            close :  Number(Object.values(stockIntervalData)[3]),
            volume :  Number(Object.values(stockIntervalData)[4]),
            time: new Date( israelTime.format("YYYY-MM-DD HH:mm:ss") ),
        };

        return convertedStockIntervalData;
    }
}
