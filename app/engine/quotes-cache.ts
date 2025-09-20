import { TimeFrame } from '../models/enums';
import { ICacheHistoricalData, ITDAmeritradePriceHistory } from '../models/quote-data.model';
import * as YahooAPI from '../proxy/yahoo-api';
import { logger } from '../config/winston.config';
export let cacheState = {} as ICacheHistoricalData;

export const addNewQuoteToCache = (quoteName: string) => {
    if (!cacheState.hasOwnProperty(quoteName)) {
        cacheState[quoteName] = {
            quoteFullYearDailyHistory: {} as ITDAmeritradePriceHistory,
            quoteFullYearWeeklyHistory: {} as ITDAmeritradePriceHistory,
            quoteHourlyHistory: {} as ITDAmeritradePriceHistory,
        };
    }
};

export const cacheQuote = ((quoteName:string,pricehistory:ITDAmeritradePriceHistory,timeFrame:TimeFrame) => {
    if (cacheState[quoteName]) {
        if (!pricehistory) {
            logger.error(`cacheQuote error = PriceHistory Is empty quoteName=${quoteName} timeFrame=${timeFrame}`);
        }
        else if (timeFrame===TimeFrame.Weekly){
            cacheState[quoteName].quoteFullYearWeeklyHistory = pricehistory;
        }
        else if (timeFrame===TimeFrame.Daily){
            cacheState[quoteName].quoteFullYearDailyHistory = pricehistory;
        }
        else if (timeFrame===TimeFrame.Hourly){
            cacheState[quoteName].quoteHourlyHistory = pricehistory;
        }
    }
});


export const getQuoteFromCache = ((quoteName:string,timeFrame:TimeFrame): ITDAmeritradePriceHistory | null => {
    if (cacheState[quoteName]) {
        if (timeFrame===TimeFrame.Weekly){
            return cacheState[quoteName].quoteFullYearWeeklyHistory;
        }
        else if (timeFrame===TimeFrame.Daily){
            return cacheState[quoteName].quoteFullYearDailyHistory;
        }
        else if (timeFrame===TimeFrame.Hourly){
            return cacheState[quoteName].quoteHourlyHistory;
        }
    }
    return null;
});

export const cacheQuoteFromYahooAPI = async (quoteName:string) => {
    if (!cacheState[quoteName]) {
        addNewQuoteToCache(quoteName);
        const quoteFullYearDailyHistory = await YahooAPI.getQuoteFullYearDailyHistory(quoteName);
        cacheQuote(quoteName,quoteFullYearDailyHistory,TimeFrame.Daily);
        const quoteFullYearWeeklyHistory = await YahooAPI.getQuoteFullYearWeeklyHistory(quoteName);
        cacheQuote(quoteName,quoteFullYearWeeklyHistory,TimeFrame.Weekly); 
        const quoteHourlyHistory = await YahooAPI.getQuoteHourlyHistory(quoteName);
        cacheQuote(quoteName,quoteHourlyHistory,TimeFrame.Hourly); 
    }
}

export const cacheQuoteListFromYahooAPI = async (quoteListNames:string[]) => {
    try {
        logger.info("Initiating Quote caching...");
        for (let quoteName of quoteListNames) {
            await cacheQuoteFromYahooAPI(quoteName);
            logger.info(`${quoteName} has been cached`);
        }
        logger.info("All Quotes have been cached succesfully");
    }
    catch (err) {
        logger.error('cacheQuoteListFromYahooAPI failed ' + err);
    }
    
}

export const deleteCache = (quoteName:string) => {
    delete cacheState[quoteName];
}
