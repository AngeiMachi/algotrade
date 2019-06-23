import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME } from "./config";
import { IStockIntervalData, IAlphaVantageIntervals, IStockFullIntervalData } from "./models/stock-interval-data.model";

export class StockStats {
    private quote: string;
    private volumeSum: number;
    private iteration: number;
    private avg: number;
    private todayDate: string;
    private stockIntervals: IStockFullIntervalData[] = [];

    constructor(quote: string) {
        this.quote = quote;
        this.volumeSum = 0;
        this.iteration = 0;
        this.avg = 0;

        // this.todayDate = moment(new Date()).format("YYYY-MM-DD");
        this.todayDate = "2019-06-21"; // for testing
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

    public recordNewStockInterval(stockInterval: IStockIntervalData) {
        console.log(stockInterval);

        this.calculateAverageVolume(stockInterval as IStockFullIntervalData);

        
        
    }

    private calculateAverageVolume(stockInterval: IStockFullIntervalData) {
        if (this.iteration >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
            const {volume} = stockInterval ;
            this.volumeSum += volume;
            this.iteration++;
            this.avg = this.volumeSum / this.iteration;

            if (this.didPassVolumeThreshold( volume )) {
                console.log(this.quote + " quote passed threshold");
            }
        }
    }

    private didPassVolumeThreshold(volume: number): boolean {
        return ( volume > this.avg * VOLUME_THRESHOLD_ALARM );
    }

    private convertAlphaVantageFormat(stockIntervalData: IAlphaVantageIntervals, key: string): IStockFullIntervalData {
        const convertedStockIntervalData: IStockFullIntervalData = {
            open :  Number(Object.values(stockIntervalData)[0]) ,
            high :  Number(Object.values(stockIntervalData)[1]),
            low :  Number(Object.values(stockIntervalData)[2]),
            close :  Number(Object.values(stockIntervalData)[3]),
            volume :  Number(Object.values(stockIntervalData)[4]),
            time: new Date(key),
        };
        return convertedStockIntervalData;
    }
}
