import * as _ from "lodash";
import moment from "moment-timezone";
import * as request from "request";
import * as environmentConfig from "./config/environment.Config.json";
import { logger } from "./config/winston.config.js";
import * as queryString from "query-string";

const TD_BASE_API = "https://api.tdameritrade.com/v1";
const GET_ACCESS_TOKEN = "/oauth2/token";

let token: any = {};

export const getAccessToken = async () => {
    const formData = {
        grant_type: "refresh_token",
        refresh_token: environmentConfig.TDAmeritradeAPI.refresh_token,
        client_id: environmentConfig.TDAmeritradeAPI.client_id,
    };

    request.post({ url: TD_BASE_API + GET_ACCESS_TOKEN, qs: queryString.stringify(formData),
         headers:{ 'Content-Type': 'application/x-www-form-urlencoded' } 
        
        }, (err: string, httpResponse: any, body: any) => {
            if (err) {
                logger.error ("getAccessToken failed " + err );
            }
            token = body;
    });
};

export const getQuote5MinuteHistory = async (quote: string):Promise<any> => {
    return new Promise( (resolve, reject) => {
        const formData = {
            frequencyType: "minute",
            startDate: "",
            frequency: "5",
            apikey: environmentConfig.TDAmeritradeAPI.client_id,
            needExtendedHoursData: true,
        };
    
        request.get({ url: "https://api.tdameritrade.com/v1/marketdata/AMZN/pricehistory?apikey=ANGELMALCA&frequencyType=minute&frequency=5&startDate=1547307000000&needExtendedHoursData=false ",
            headers: { Authorization: "Bearer " +   environmentConfig.TDAmeritradeAPI.bearer_token },
    
           }, (err: string, httpResponse: any, body: any) => {
               if (err) {
                   logger.error ("getAccessToken failed " + err );
               }
               const response = JSON.parse(body);
               const grouped = _.groupBy(response.candles, getIntervals);
               resolve(grouped);
               
        });
    });
};

function getIntervals(interval: any) {
    console.log( moment(interval.datetime).format("YYYY-MM-DD HH:mm:ss"));
    let x = moment(interval.datetime).format("YYYY-MM-DD");
    return x;
}
