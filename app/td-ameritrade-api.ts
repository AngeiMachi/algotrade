import * as _ from "lodash";
import moment from "moment-timezone";
import * as request from "request-promise";
import * as environmentConfig from "./config/environment.Config.json";
import { logger } from "./config/winston.config.js";
import * as queryString from "query-string";
import { convertTDAmeritrade5MinuteIntervals, convertTDAmeritradeMultipleDaysOf5MinuteIntervals } from "./utils/utils.js";
import { parseMustache } from "./utils/general.js";

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

export const getQuote5MinuteHistory = async (quote: string): Promise<any> => {
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
        const groupedIntervalsByDay = _.groupBy(parsedResponse.candles, groupByDateFunction);
        delete groupedIntervalsByDay[Object.keys(groupedIntervalsByDay)[0]];

        const quote5MinuteHistory = convertTDAmeritradeMultipleDaysOf5MinuteIntervals(groupedIntervalsByDay);
        return quote5MinuteHistory;
    } catch (err) {
        logger.error("getQuote5MinuteHistory failed " + err);
        throw err;
    }
};

function groupByDateFunction(interval: any) {
    return moment(interval.datetime).format("YYYY-MM-DD");
}
