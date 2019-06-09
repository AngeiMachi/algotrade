import {  VOLUME_THRESHOLD_ALARM , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE } from "./config";
import { IStockIntervalData } from "./models/stock-interval-data.model";

export class StockStats {
    private quote: string;
    private volumeSum: number;
    private iteration: number;
    private avg: number;

    constructor(quote: string) {
        this.quote = quote;
        this.volumeSum = 0;
        this.iteration = 0;
        this.avg = 0;
    }

    public recordNewStockInterval(stockInterval: IStockIntervalData) {
        console.log(stockInterval);
        const {volume} = stockInterval ;

        if (this.didPassVolumeThreshold( volume )) {
            console.log(this.quote + " quote passed threshold");
        }
        this.volumeSum += volume;
        this.iteration++;
        this.avg = this.volumeSum / this.iteration;
    }

    private didPassVolumeThreshold(volume: number): boolean {
        return (volume > this.avg * VOLUME_THRESHOLD_ALARM && this.iteration>= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE);
    }
}