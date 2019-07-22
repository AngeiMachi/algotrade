import * as _ from "lodash";
import moment from "moment-timezone";
import * as request from "request-promise";
import * as environmentConfig from "./config/environment.Config.json";
import { logger } from "./config/winston.config.js";
import * as queryString from "query-string";
import { convertTDAmeritradeMultipleDaysOf5MinuteIntervals } from "./utils/utils.js";
import { parseMustache } from "./utils/general.js";
import { IQouteHistoricalIntervals, ITDAmeritradePriceHistory } from "./models/stock-interval-data.model.js";

const TD_BASE_API = "https://api.tdameritrade.com/v1";
const GET_ACCESS_TOKEN = "/oauth2/token";

let token: any = {};

export const getAccessToken = async () => {
    const formData = {
        grant_type: "refresh_token",
        refresh_token: environmentConfig.TDAmeritradeAPI.refresh_token,
        client_id: environmentConfig.TDAmeritradeAPI.api_key,
    };

    await request.post({
        url: TD_BASE_API + GET_ACCESS_TOKEN, qs: queryString.stringify(formData),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

};

export const getQuote5MinuteHistory = async (quote: string,specificTradeDates:string[]=[]): Promise<IQouteHistoricalIntervals> => {
    try {
        const options = {
            quote: quote.toUpperCase(),
            api_key: environmentConfig.TDAmeritradeAPI.api_key
        }
        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_5_minutes, options);

        const response = await request.get({
            url: fullURL,
            headers: { Authorization: "Bearer " + environmentConfig.TDAmeritradeAPI.bearer_token }
        });

        const parsedResponse = JSON.parse(response);
        let  groupedIntervalsByDay = _.groupBy(parsedResponse.candles, groupByDateFunction);
        
        if (specificTradeDates.length>0) {
            groupedIntervalsByDay = _.pick(groupedIntervalsByDay,specificTradeDates);
        }
        
        groupedIntervalsByDay = _.omitBy(groupedIntervalsByDay, intervals =>  intervals.length!=78);
       
        const quote5MinuteHistory = convertTDAmeritradeMultipleDaysOf5MinuteIntervals(groupedIntervalsByDay);
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
        }
        const fullURL = parseMustache(environmentConfig.TDAmeritradeAPI.URL.get_historical_daily_full_Year, options);

        const response = await request.get({
            url: fullURL,
            headers: { Authorization: "Bearer " + environmentConfig.TDAmeritradeAPI.bearer_token }
        });

        const dailyIntervals = JSON.parse(response) as ITDAmeritradePriceHistory;
        
        return dailyIntervals;
    } catch (err) {
        logger.error("getQuoteFullYearDailyHistorry failed " + err);
        throw err;
    }
};

function groupByDateFunction(interval: any) {
    return moment(interval.datetime).format("YYYY-MM-DD");
}
