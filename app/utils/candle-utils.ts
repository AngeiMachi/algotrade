
import {
    IQuoteFullIntervalData,
} from '../models/quote-data.model';


export const isHammer = (interval:IQuoteFullIntervalData):boolean => {
    const legReferencePoint = interval.close>interval.open?interval.open:interval.close;
    const headReferencePoint = interval.close>interval.open?interval.close:interval.open;  
    const legLength = Math.abs(interval.low-legReferencePoint);
    const fullCandleLength = Math.abs(interval.low-interval.high);
    const bodyLength= Math.abs(interval.open-interval.close);
    const headLength= Math.abs(headReferencePoint-interval.high);
    if (legLength*1.6>(fullCandleLength-headLength) && bodyLength<legLength && headLength<legLength) {
        return true;
    } else {
        return false;
    }
}

export const isInvertedHammer = (interval:IQuoteFullIntervalData):boolean => {
    const legReferencePoint = interval.close>interval.open?interval.open:interval.close;
    const headReferencePoint = interval.close>interval.open?interval.close:interval.open;  
    const legLength = Math.abs(interval.low-legReferencePoint);
    const fullCandleLength = Math.abs(interval.low-interval.high);
    const bodyLength= Math.abs(interval.open-interval.close);
    const headLength= Math.abs(headReferencePoint-interval.high);
    if (headLength*1.6>(fullCandleLength-legLength) && bodyLength<headLength && headLength>legLength) {
        return true;
    } else {
        return false;
    }
}

export const isGreeen = (interval:IQuoteFullIntervalData):boolean => {
    return interval.close>interval.open
}