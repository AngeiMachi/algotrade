import { SentimentDirectionEnum, SignalGroupType, SignalType, SignalVerificationReasonEnum } from './enums';
import { IQuoteFullIntervalData } from './quote-data.model';

export interface SignalModel {
    signalGroupType: SignalGroupType;
    signalType: SignalType;
    signalDescription: string;
    signalSentiment?: SentimentDirectionEnum;
    payload?: any;
    interval?:IQuoteFullIntervalData;
    withNotification?:boolean;
    isHidden?:boolean;
}
