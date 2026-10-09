import moment from 'moment-timezone';

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
import { IQuoteIntervals, IMarketHours, IQuoteFullIntervalData } from '../models/quote-data.model';

const NEW_YORK = 'America/New_York';
const KEY_FORMAT = 'YYYY-MM-DD HH:mm:ss';

interface IQuoteMockData {
    quote: string;
    mockDataResponse: IQuoteIntervals | IAlphaVantageQuoteData;
    mockDataResponseValues: any[];
    mockDataResponseKeys: any[];
    currentInterval: number;
    isMockLoaded: boolean;
    mockDataDate: string;
    oneMinuteBars: IQuoteIntervals; // decision window only, to rebuild the forming 5-minute candle
}

const mockDataInitial: IQuoteMockData = {
    quote: '',
    mockDataResponse: {},
    mockDataResponseValues: [],
    mockDataResponseKeys: [],
    currentInterval: 0,
    isMockLoaded: false,
    mockDataDate: '',
    oneMinuteBars: {},
};

const mockQuotes: { [key: string]: IQuoteMockData } = {};

let marketHours = {} as IMarketHours;

// Simulated New York time ('YYYY-MM-DD HH:mm:ss'). SPY advances it each lap; every 5-minute bar that has ended by then is served.
let mockNow = '';

export const getMockNow = (): moment.Moment | null => (mockNow ? moment.tz(mockNow, KEY_FORMAT, NEW_YORK) : null);

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
        mockQuote.oneMinuteBars = await AlpacaAPI.getQuote1MinuteIntraday(
            quote,
            mockQuote.mockDataDate,
            globalConfig.PremarketRace.decisionWindowStart,
            bellKey().substring(11, 16)
        );

        mockQuote.mockDataResponseValues = Object.values(mockData);
        mockQuote.mockDataResponseKeys = Object.keys(mockData);

        const hasMoreIntervals = () => mockQuote.currentInterval < mockQuote.mockDataResponseKeys.length;

        if (!hasMoreIntervals()) {
            logger.error('prepareMockData5Minute ' + quote + ' - no mock data for ' + mockQuote.mockDataDate);
        } else if (mockNow) {
            serveEndedBars(mockQuote);
        } else {
            do {
                serveNextBar(mockQuote);
            } while (
                hasMoreIntervals() &&
                ((mockQuote.mockDataResponseKeys[mockQuote.currentInterval] !== marketHours.sessionHours.regularMarket.start && globalConfig.Mock.startAtOpen) ||
                    (!mockQuote.mockDataResponseKeys[mockQuote.currentInterval].includes(marketHours.date + ' ' + globalConfig.Mock.MockDataLiveSimulationTime) &&
                        !globalConfig.Mock.startAtOpen))
            );
            if (quote === 'SPY') {
                mockNow = addMinutes(mockQuote.mockDataResponseKeys[mockQuote.currentInterval - 1], 5);
            }
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
            if (!mockNow) {
                if (mockQuote.mockDataResponseKeys[mockQuote.currentInterval]) {
                    serveNextBar(mockQuote);
                }
            } else {
                if (quote === 'SPY') {
                    advanceMockClock();
                }
                serveEndedBars(mockQuote);
            }

            resolve({ ...mockQuote.mockDataResponse });
        } catch (err) {
            return reject(err);
        }
    });
}

// Ended bars plus, inside the decision window, the 5-minute candle still forming, rebuilt from the minutes so far.
export function serveMockIntervalsWithFormingCandle(quote: string): IQuoteIntervals {
    const mockQuote = mockQuotes[quote];
    const intervals = { ...(mockQuote.mockDataResponse as IQuoteIntervals) };
    const formingKey: string | undefined = mockQuote.mockDataResponseKeys[mockQuote.currentInterval];

    if (!formingKey || formingKey >= mockNow || !isInsideDecisionWindow(formingKey)) {
        return intervals;
    }

    const minutes = Object.keys(mockQuote.oneMinuteBars)
        .filter((key) => key >= formingKey && key < mockNow)
        .sort()
        .map((key) => mockQuote.oneMinuteBars[key]);

    if (minutes.length > 0) {
        const fullBar: IQuoteFullIntervalData = mockQuote.mockDataResponseValues[mockQuote.currentInterval];
        intervals[formingKey] = {
            ...fullBar,
            open: minutes[0].open,
            high: Math.max(...minutes.map((minute) => minute.high)),
            low: Math.min(...minutes.map((minute) => minute.low)),
            close: minutes[minutes.length - 1].close,
            volume: minutes.reduce((total, minute) => total + minute.volume, 0),
        };
    }
    return intervals;
}

export function isMockLoaded(quote: string): boolean {
    return mockQuotes[quote] && mockQuotes[quote].isMockLoaded;
}

// One minute per lap inside the decision window, so the forming candle can be watched; five minutes elsewhere.
const advanceMockClock = () => {
    mockNow = addMinutes(mockNow, isInsideDecisionWindow(mockNow) ? 1 : 5);
};

const serveEndedBars = (mockQuote: IQuoteMockData) => {
    while (mockQuote.mockDataResponseKeys[mockQuote.currentInterval] && addMinutes(mockQuote.mockDataResponseKeys[mockQuote.currentInterval], 5) <= mockNow) {
        serveNextBar(mockQuote);
    }
};

const serveNextBar = (mockQuote: IQuoteMockData) => {
    (mockQuote.mockDataResponse as any)[mockQuote.mockDataResponseKeys[mockQuote.currentInterval]] = mockQuote.mockDataResponseValues[mockQuote.currentInterval];
    mockQuote.currentInterval++;
};

const isInsideDecisionWindow = (key: string) => key >= `${key.substring(0, 10)} ${globalConfig.PremarketRace.decisionWindowStart}:00` && key < bellKey();

const bellKey = () => marketHours?.sessionHours?.regularMarket?.start || `${quoteUtils.getCurrentTradingDate()} 09:30:00`;

const addMinutes = (key: string, minutes: number) => moment.tz(key, KEY_FORMAT, NEW_YORK).add(minutes, 'minutes').format(KEY_FORMAT);

function mockQuotesFactory(quote: string): IQuoteMockData {
    return { ...{}, ...mockDataInitial, mockDataResponse: {}, oneMinuteBars: {}, mockDataDate: quoteUtils.getCurrentTradingDate(), quote };
}
