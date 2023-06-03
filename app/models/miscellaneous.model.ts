import { BehaviorTypes } from "./enums";

export type QuoteGroupConfig = {
    names:string[],
    behaviors?:BehaviorTypes[],
    signals?:string[],
  };