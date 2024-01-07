import { MADirectionEnum, MovingAverageType, SentimentDirectionEnum, SignalGroupType, SignalType, SignalVerificationReasonEnum } from './enums';
import { IQuoteFullIntervalData } from './quote-data.model';

export interface SignalModel {
    signalGroupType: SignalGroupType;
    signalType: SignalType;
    signalDescription: string;
    signalSentiment?: SentimentDirectionEnum;
    payload?: any;
    interval?:IQuoteFullIntervalData;
    withNotification?:boolean;
    isDeveloperMode?:boolean;
}

export type MaPointing = {
    direction:MADirectionEnum,
    maType:MovingAverageType,
}
export type MaCrosssisng = {
    maType:MovingAverageType,
    crossedBy:MovingAverageType,
    direction:MADirectionEnum,
}
export interface TacticalDirectionChangeSignalInput {
    maPointing: MaPointing[];
    maCrosssisng?:MaCrosssisng[];
    isTriggered:boolean;
    info:string;
}
