import { BehaviorTypes } from "./enums";

export type FunctionalBehavior = {behavior:BehaviorTypes,values:number[]};
export type Behaviors<BehaviorTypes,FunctionalBehavior> = BehaviorTypes | FunctionalBehavior;

export type QuoteGroupConfig = {
    names:string[],
    behaviors?:Behaviors<BehaviorTypes,FunctionalBehavior>[],
    signals?:string[],
  };