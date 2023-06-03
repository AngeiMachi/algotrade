import { IQuoteMetadata, IQuotes } from '../models/quote-data.model';
import * as globalConfig from '../config/globals.config'
import {QuoteGroupConfig} from '../models/miscellaneous.model'
import { BehaviorTypes } from '../models/enums';
import { logger } from '../config/winston.config';
import * as PushAPI from '../proxy/pushed-api';

const quotesFlat :{[key:string]: string}={};
const quotesList : string[]=[];
let quoteToBeUsed : {[key:string]:QuoteGroupConfig} = {}

export const getQuotes = ():string[] => {
    quoteToBeUsed = globalConfig.Mock.IsMock? globalConfig.QuotesConfig.testing : globalConfig.QuotesConfig.producion;
    for (const [key, value] of Object.entries(quoteToBeUsed)) {
        for (let name of value.names) {
            if (!quotesFlat[name]) {
                quotesFlat[name] = key;
                quotesList.push(name);
            } else {
                logger.info(`${name} is already declared(${key})!`);
                PushAPI.sendPushMessage(`${name} is already declared(${key})!`);
            }
           
        }
    } 
    return quotesList;
}

export const manangeAfterMetadata=(quoteName:string,metadata:IQuoteMetadata,quotes: IQuotes):void => {
    const quoteConfigGroupName = quotesFlat[quoteName];
    const deprecateIfNotAboveMovingAverages = quoteToBeUsed[quoteConfigGroupName].behaviors?.find((item)=>item==BehaviorTypes.DeprecateIfNotAboveMovingAverages)
    if (deprecateIfNotAboveMovingAverages !== undefined) {
        if (!(metadata.previousDay.close>metadata.SMA20.previousDay &&
           (metadata.previousDay.close>metadata.SMA10.previousDay || 
            metadata.SMA10.previousDay>metadata.SMA20.previousDay))) {
                logger.info(`${quoteName} Deprecate If Not Above Moving Averages`);
                delete quotes[quoteName]
            }

    }
}