import * as _ from "lodash";
import moment from "moment-timezone";
import * as request from "request-promise";

import * as environmentConfig from "../config/environment.Config.json";
import { logger } from "../config/winston.config.js";

import { parseMustache } from "../utils/general";
import * as convertUtils from "../utils/convert-utils";

import { IQuoteHistoricalIntervals,
         ITDAmeritradePriceHistory } from "../models/stock-interval-data.model";


export const getQuote5MinuteHistory = async (quote: string, specificTradeDates: string[]= []): Promise<IQuoteHistoricalIntervals> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
            api_key: environmentConfig.TDAmeritradeAPI.api_key,
        };
        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_5_minutes, options);

        const response = await request.get({
            url: fullURL,

        });

        const parsedResponse = JSON.parse(response);
        let  groupedIntervalsByDay = _.groupBy(parsedResponse.candles, groupByDateFunction);

        if (specificTradeDates.length > 0) {
            groupedIntervalsByDay = _.pick(groupedIntervalsByDay,specificTradeDates);
        }

        groupedIntervalsByDay = _.omitBy(groupedIntervalsByDay, (intervals) =>  intervals.length !== 78);

        const quote5MinuteHistory = convertUtils.convertTDAmeritradeMultipleDaysOf5MinuteIntervals(groupedIntervalsByDay);
        return quote5MinuteHistory;
    } catch (err) {
        logger.error("getQuote5MinuteHistory failed " + err);
        throw err;
    }
};

export const getQuoteFullYearDailyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
        };

        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_daily_full_Year, options);

        const response = await request.get({
            url: fullURL
        });

        const dailyIntervals = JSON.parse(response) as ITDAmeritradePriceHistory;

        return dailyIntervals;
    } catch (err) {
        logger.error("getQuoteFullYearDailyHistory failed " + err);
        throw err;
    }
};

function groupByDateFunction(interval: any) {
    return moment(interval.datetime).format("YYYY-MM-DD");
}
