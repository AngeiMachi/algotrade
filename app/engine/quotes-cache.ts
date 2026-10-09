import { TimeFrame } from '../models/enums';
import { ICacheHistoricalData, ITDAmeritradePriceHistory } from '../models/quote-data.model';
import * as AlpacaAPI from '../proxy/alpaca-api';
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

export const cacheQuoteFromAPI = async (quoteName:string) => {
    if (!cacheState[quoteName]) {
        addNewQuoteToCache(quoteName);
        const [quoteFullYearDailyHistory, quoteFullYearWeeklyHistory, quoteHourlyHistory] = await Promise.all([
            AlpacaAPI.getQuoteFullYearDailyHistory(quoteName),
            AlpacaAPI.getQuoteFullYearWeeklyHistory(quoteName),
            AlpacaAPI.getQuoteHourlyHistory(quoteName),
        ]);
        cacheQuote(quoteName,quoteFullYearDailyHistory,TimeFrame.Daily);
        cacheQuote(quoteName,quoteFullYearWeeklyHistory,TimeFrame.Weekly); 
        cacheQuote(quoteName,quoteHourlyHistory,TimeFrame.Hourly); 
    }
}

// all quotes are requested together so alpaca-api can batch them into multi-symbol calls
export const cacheQuoteList = async (quoteListNames:string[]) => {
    logger.info("Initiating Quote caching...");
    await Promise.all(quoteListNames.map(async (quoteName) => {
        try {
            await cacheQuoteFromAPI(quoteName);
            logger.info(`${quoteName} has been cached`);
        } catch (err) {
            deleteCache(quoteName);
            logger.error(`cacheQuoteList failed for ${quoteName} ` + err);
        }
    }));
    logger.info("All Quotes have been cached");
}

export const deleteCache = (quoteName:string) => {
    delete cacheState[quoteName];
}
