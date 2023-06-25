
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
    if (legLength*1.5>fullCandleLength && bodyLength<legLength) {
        return true;
    } else {
        return false;
    }

}