import * as _ from "lodash";

import { ITDAmeritradeIntervalData } from "../models/stock-interval-data.model";
import { convertDateToTDMillisecondInterval } from "./utils";

export function calculateAverage(intervals:ITDAmeritradeIntervalData[],currentTime:string,intervalsToAverageBack:number):number {

    const index = getIntervalIndex(intervals, currentTime );
    if (index>-1) {
        const intervalsForAverage = _.slice(intervals, index-intervalsToAverageBack, index);
        const average = _.meanBy(intervalsForAverage, 'volume');
        return average;
    }
    return -1;
  
}
export function getPreviousClose(intervals:ITDAmeritradeIntervalData[],currentTime:string) {
    const index = getIntervalIndex(intervals, currentTime );
    if (index>-1) {
        return intervals[index-1].close
    }
    return -1;
}

export function getPartialHistory(intervals:ITDAmeritradeIntervalData[],currentTime:string | number,intervalsToHistoryBack:number) : ITDAmeritradeIntervalData[] {
   
    let index;
    if (typeof currentTime==="string") {
        index = getIntervalIndex(intervals , currentTime);
    } else {
        index = _.findIndex(intervals, ['datetime', currentTime]);
    }
    if (index>-1) {
        const intervalsBack = _.slice(intervals, index-intervalsToHistoryBack, index+1);
        return intervalsBack;
    }
    return [];
}

function getIntervalIndex(intervals:ITDAmeritradeIntervalData[],currentTime:string ) {
    // date is 00:00 . TDAmeritrade daily interval is at 08:00 = 28800000 or 07:00 = 25200000
    let currentTimeInMilliseconds = convertDateToTDMillisecondInterval(currentTime);

    let index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds+28800000]);
    if (index>-1) {
        return index;
    }
    index = _.findIndex(intervals, ['datetime', currentTimeInMilliseconds+25200000]);
    
    return index;
}