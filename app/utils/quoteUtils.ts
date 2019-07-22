import * as _ from "lodash";

import { ITDAmeritradeIntervalData } from "../models/stock-interval-data.model";
import { convertDateToTDMillisecondInterval } from "./utils";

export function calculateAverage(intervals:ITDAmeritradeIntervalData[],currentTime:string,intervalsToAverageBack:number):number {
    const currentTimeInMilliseconds =  convertDateToTDMillisecondInterval(currentTime)
    const index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds]);
    if (index>-1) {
        const intervalsForAverage = _.slice(intervals, index-intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, 'volume');
        return average;
    }
    return -1;
  
}
export function getPreviousClose(intervals:ITDAmeritradeIntervalData[],currentTime:string) {
    const currentTimeInMilliseconds =  convertDateToTDMillisecondInterval(currentTime);
    const index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds]);
    if (index>-1) {
        return intervals[index-1].close
    }
    return -1;
}