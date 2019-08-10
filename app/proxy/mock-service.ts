import * as globalConfig from "../config/globals.config";

import * as quoteUtils from "../utils/quote-utils";

import * as AlphaVantage from "./alpha-vantage-api";

import {
    IAlphaVantageIntervals,
    INTERVAL_PROPERTY_NAME,
    METADATA_PROPERTY_NAME,
    LAST_REFRESHED_PROPERTY_NAME
} from "../models/alpha-vantage.model";



interface IQuoteMockData {
    mockDataResponse: any,
    mockDataResponseValues: any[];
    mockDataResponseKeys: any[];
    currentInterval: number;
    isMockLoaded: boolean;
    mockDataDate: string;
}

const mockDataInitial: IQuoteMockData = {
    mockDataResponse: {
        [INTERVAL_PROPERTY_NAME]:{},
        [METADATA_PROPERTY_NAME]:{}
    },
    mockDataResponseValues: [],
    mockDataResponseKeys: [],
    currentInterval: globalConfig.Mock.StartLiveSimulationAtInterval,
    isMockLoaded: false,
    mockDataDate: "",
}

const mockQuotes: { [key: string]: IQuoteMockData } = {};

export async function prepareMockData(quote: string): Promise<any> {
    const mockData = {} as IAlphaVantageIntervals;
    const mockQuote = mockQuotes[quote] = mockQuotesFactory(quote);

    try {
        const quoteMockResponse = await AlphaVantage.getIntraday5Minute(quote, "full");

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

export async function serveMockData(quote:string): Promise<any> {
    const mockQuote = mockQuotes[quote];
    return new Promise((resolve, reject) => {
        try {
            if (mockQuote.mockDataResponseKeys[mockQuote.currentInterval]) {
                mockQuote.mockDataResponse[INTERVAL_PROPERTY_NAME][mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] =
                                                                    mockQuote.mockDataResponseValues[mockQuote.currentInterval];
                mockQuote.mockDataResponse[METADATA_PROPERTY_NAME][LAST_REFRESHED_PROPERTY_NAME] =
                                                                    mockQuote.mockDataResponseKeys[mockQuote.currentInterval];
                mockQuote.currentInterval++;
            }
            resolve(mockQuote.mockDataResponse);
        } catch (err) {
            return reject(err);
        }
    });
}

export function isMockLoaded(quote:string): boolean {
    return mockQuotes[quote] && mockQuotes[quote].isMockLoaded;
}

function mockQuotesFactory(quote: string): IQuoteMockData {
    return { ...{}, ...mockDataInitial, mockDataDate: quoteUtils.getCurrentTradingDay() };
}