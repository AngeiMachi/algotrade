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

export const getQuoteHistory = async (quote:string) => {
    const formData = {
        frequencyType: "minute",
        startDate:"1511490267",
        frequency:"5",
        apikey: environmentConfig.TDAmeritradeAPI.client_id,
    };

    request.post({ url: TD_BASE_API +"/marketdata/" + quote.toUpperCase() + "/pricehistory", qs: queryString.stringify(formData),
        headers:{ 'Authorization': 'Bearer ' +   environmentConfig.TDAmeritradeAPI.bearer_token  }
       
       }, (err: string, httpResponse: any, body: any) => {
           if (err) {
               logger.error ("getAccessToken failed " + err );
           }
           token = body;
    });
};

