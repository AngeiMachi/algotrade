import { logger } from '../config/winston.config';
import * as globalConfig from '../config/globals.config';
import * as quoteUtils from '../utils/quote-utils';
import * as AlphaVantage from './alpha-vantage-api';
import * as AlpacaAPI from './alpaca-api';

import {
    IAlphaVantageIntervals,
    INTERVAL_PROPERTY_NAME,
    METADATA_PROPERTY_NAME,
    LAST_REFRESHED_PROPERTY_NAME,
    IAlphaVantageQuoteData,
} from '../models/alpha-vantage.model';
import { ITDAmeritradeIntervals, IQuoteIntervals, IMarketHours } from '../models/quote-data.model';

interface IQuoteMockData {
    quote: string;
    mockDataResponse: IQuoteIntervals | IAlphaVantageQuoteData;
    mockDataResponseValues: any[];
    mockDataResponseKeys: any[];
    currentInterval: number;
    isMockLoaded: boolean;
    mockDataDate: string;
}

const mockDataInitial: IQuoteMockData = {
    quote: '',
    mockDataResponse: {},
    mockDataResponseValues: [],
    mockDataResponseKeys: [],
    currentInterval: 0,
    isMockLoaded: false,
    mockDataDate: '',
};

const mockQuotes: { [key: string]: IQuoteMockData } = {};

let marketHours = {} as IMarketHours;

export async function prepareMockDataAlphaVantage(quote: string): Promise<any> {
    const mockData = {} as IAlphaVantageIntervals;
    const mockQuote = (mockQuotes[quote] = mockQuotesFactory(quote));

    try {
        const quoteMockResponse = await AlphaVantage.getIntraday5Minute(quote, 'full');

        Object.keys(quoteMockResponse[INTERVAL_PROPERTY_NAME]).forEach((key) => {
            if (key.includes(mockQuote.mockDataDate)) {
                mockData[key] = quoteMockResponse[INTERVAL_PROPERTY_NAME][key];
            }
        });

        mockQuote.mockDataResponseValues = Object.values(mockData).reverse();
        mockQuote.mockDataResponseKeys = Object.keys(mockData).reverse();

        for (let i = 0; i < mockQuote.currentInterval; i++) {
            mockQuote.mockDataResponse[INTERVAL_PROPERTY_NAME][mockQuote.mockDataResponseKeys[i]] = mockQuote.mockDataResponseValues[i];
        }

        mockQuote.mockDataResponse[METADATA_PROPERTY_NAME] = quoteMockResponse[METADATA_PROPERTY_NAME];

        mockQuote.isMockLoaded = true;

        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function serveMockDataAlphaVantage(quote: string): Promise<any> {
    const mockQuote = mockQuotes[quote];
    return new Promise((resolve, reject) => {
        try {
            if (mockQuote.mockDataResponseKeys[mockQuote.currentInterval]) {
                mockQuote.mockDataResponse[INTERVAL_PROPERTY_NAME][mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] =
                    mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                mockQuote.mockDataResponse[METADATA_PROPERTY_NAME][LAST_REFRESHED_PROPERTY_NAME] = mockQuote.mockDataResponseKeys[mockQuote.currentInterval];
                mockQuote.currentInterval++;
            }
            logger.debug('serving ' + quote + '...', JSON.stringify(mockQuote));
            resolve(mockQuote.mockDataResponse);
        } catch (err) {
            return reject(err);
        }
    });
}

export async function prepareMockData5Minute(quote: string, _marketHours: IMarketHours): Promise<any> {
    marketHours = _marketHours;

    let mockData = {} as IQuoteIntervals;
    const mockQuote = (mockQuotes[quote] = mockQuotesFactory(quote));

    try {
        mockData = await AlpacaAPI.getQuote5MinuteIntraday(quote, mockQuote.mockDataDate);

        mockQuote.mockDataResponseValues = Object.values(mockData);
        mockQuote.mockDataResponseKeys = Object.keys(mockData);

        const hasMoreIntervals = () => mockQuote.currentInterval < mockQuote.mockDataResponseKeys.length;

        if (!hasMoreIntervals()) {
            logger.error('prepareMockData5Minute ' + quote + ' - no mock data for ' + mockQuote.mockDataDate);
        } else if  (mockQuotes["SPY"]?.isMockLoaded ) {
            while (hasMoreIntervals() && new Date(mockQuote.mockDataResponseKeys[mockQuote.currentInterval])<new Date(mockQuotes["SPY"].mockDataResponseKeys[mockQuotes["SPY"].currentInterval-1])) {
                (mockQuote.mockDataResponse as any)[mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] = mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                mockQuote.currentInterval++;
            } 

        }  else {
            do {
                (mockQuote.mockDataResponse as any)[mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] = mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                mockQuote.currentInterval++;
            } 
            while (hasMoreIntervals() && (
            (mockQuote.mockDataResponseKeys[mockQuote.currentInterval] !== marketHours.sessionHours.regularMarket.start && globalConfig.Mock.startAtOpen) || 
            (!mockQuote.mockDataResponseKeys[mockQuote.currentInterval].includes(marketHours.date+' '+globalConfig.Mock.MockDataLiveSimulationTime) && !globalConfig.Mock.startAtOpen)));
        }
        
        mockQuote.isMockLoaded = true;
        mockQuotes[quote] = mockQuote;

        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function serveMockData5Minute(quote: string): Promise<any> {
    const mockQuote = mockQuotes[quote];
    return new Promise((resolve, reject) => {
        try {
            if (mockQuotes['SPY'].isMockLoaded && mockQuote.quote!=='SPY') {
                if(new Date(mockQuote.mockDataResponseKeys[mockQuote.currentInterval])<=new Date(mockQuotes["SPY"].mockDataResponseKeys[mockQuotes["SPY"].currentInterval-1])) {
                    (mockQuote.mockDataResponse as any)[mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] =
                    mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                    mockQuote.currentInterval++;
                }
            }
            
            else if (mockQuote.mockDataResponseKeys[mockQuote.currentInterval]) {
                (mockQuote.mockDataResponse as any)[mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] =
                    mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                mockQuote.currentInterval++;
            }

            //logger.info('serving ' + quote + ':' + JSON.stringify(mockQuote.mockDataResponse));
            resolve({ ...mockQuote.mockDataResponse });
        } catch (err) {
            return reject(err);
        }
    });
}

export function isMockLoaded(quote: string): boolean {
    return mockQuotes[quote] && mockQuotes[quote].isMockLoaded;
}

function mockQuotesFactory(quote: string): IQuoteMockData {
    return { ...{}, ...mockDataInitial, mockDataResponse: {}, mockDataDate: quoteUtils.getCurrentTradingDate(), quote };
}
