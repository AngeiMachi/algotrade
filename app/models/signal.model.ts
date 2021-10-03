import { SentimentDirectionEnum, SignalGroupType, SignalType, SignalVerificationReasonEnum } from './enums';

export interface SignalModel {
    signalGroupType: SignalGroupType;
    signalType: SignalType;
    signalDescription: string;
    signalSentiment?: SentimentDirectionEnum;
    payload?: any;
}
