import * as request from "request-promise";

import * as environmentConfig from "../config/environment.Config.json";

import { parseMustache } from "../utils/general";

import { AsyncRevolver } from "../async-revolver";


const asyncRevolver  = new AsyncRevolver(environmentConfig.AlphaVantage.key, 16000, true,true);

export const getIntraday5Minute = async (quote:string,outputsize:string): Promise<any> => {
    const apiKey = await asyncRevolver.next();
    const options = {
        quote,
        apiKey,
        outputsize,
    };
    const fullURL = parseMustache(environmentConfig.AlphaVantage.URL.get_5_minutes, options);
    const responseData = JSON.parse(await request.get({ url: fullURL })); 

    return responseData
}

export const getDaily5SMA = async (quote:string): Promise<any> => {
    const apiKey = await asyncRevolver.next();
    const options = {
        quote,
        apiKey
    };
    const fullURL = parseMustache(environmentConfig.AlphaVantage.URL.get_daily_5_sma, options);
    const SMA =  JSON.parse(await request.get({ url: fullURL }));

    return SMA;
}