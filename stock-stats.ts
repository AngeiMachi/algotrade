import moment from "moment-timezone";

import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME } from "./config";
import { IStockIntervalData, IAlphaVantageIntervals, IStockFullIntervalData } from "./models/stock-interval-data.model";

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

    constructor(quote: string) {
        this.quote = quote;
        this.volumeSum = 0;
        this.interval = 0;
        this.volumeInterval = 0;
        this.avg = 0;

        this.isInBuyMode = false;
        this.ratioPower = 0;

        // this.todayDate = moment(new Date()).format("YYYY-MM-DD");
        this.todayDate = "2019-06-25"; // for testing
    }

    public InitializeStockData(quoteIntervals: IAlphaVantageIntervals ) {
        Object.keys(quoteIntervals).reverse().forEach((key) => {
          if (key.includes(this.todayDate)) {
            this.stockIntervals.push(this.convertAlphaVantageFormat(quoteIntervals[key], key)) ;
          }
        });

        this.stockIntervals.forEach((stockInterval) => {
            this.recordNewStockInterval(stockInterval);
        });
    }

    public recordNewStockInterval(stockInterval: IStockFullIntervalData) {
        console.log(stockInterval);

        this.calculateAverageVolume(stockInterval);

        this.interval++;

    }

    private calculateAverageVolume(stockInterval: IStockFullIntervalData) {
        if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
            const {volume} = stockInterval ;
            this.volumeSum += volume;
            this.volumeInterval++;
            this.avg = this.volumeSum / this.volumeInterval;

            if (this.didPassVolumeThreshold( volume )) {

                this.boughtInterval = {...stockInterval };
                this.isInBuyMode = true;
                this.ratioPower = this.getVolumeRatioPower(volume);
                console.log(this.quote + " quote passed threshold by " + this.ratioPower * 100 + "% at " + stockInterval.time );
            }
        }
    }

    private didPassVolumeThreshold(volume: number): boolean {
        return ( volume > this.avg * VOLUME_THRESHOLD_ALARM && !this.isInBuyMode);
    }

    private getVolumeRatioPower(volume: number): number {
        const ratio = volume / this.avg;
        return +ratio.toFixed(2);
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
