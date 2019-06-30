import moment from "moment-timezone";
import * as environmentConfig from "./config/environment.Config.json";
import { getCurrentTradingDay } from "./utils/utils.js";

import { INTERVAL_PROPERTY_NAME , METADATA_PROPERTY_NAME , LAST_REFRESHED_PROPERTY_NAME } from "./config/globals.config";
import { IAlphaVantageIntervals } from "./models/stock-interval-data.model";

export class ProxyService {

    private alphaAPI: any;

    private mockDataResponse: any = {};
    private mockDataResponseValues: any[] = [];
    private mockDataResponseKeys: any[] = [];
    private currentInterval: number ;
    private mockDataDate: string = "";
    private isMockLoaded: boolean = false;

    constructor(key: string) {
       this.alphaAPI = require("alphavantage")({ key });
       this.currentInterval = environmentConfig.Mock.StartLiveSimulationAtInterval;

       this.mockDataResponse[INTERVAL_PROPERTY_NAME] = {};
       this.mockDataResponse[METADATA_PROPERTY_NAME] = {};

       this.mockDataDate = getCurrentTradingDay();
    }

    // main method to get alphaVantage Intraday data
    public async getIntraday(quote: string): Promise< any > {
        if (environmentConfig.Mock.IsMock) {
            if (!this.isMockLoaded) {
                await this.prepareMockData(quote);
            }
            return this.serveMockData();
        } else {
            return this.alphaAPI.data.intraday(quote, "compact", "json", "5min").then( (data: any) => {
                return data ;
            });
        }
    }

    public async getHistoricalData(quote: string): Promise< any > {
        let quoteMockResponse: any; 
        
        await this.alphaAPI.data.intraday(quote, "full", "json", "5min").then( (data: any) => {
            quoteMockResponse = data ;
            Object.keys(data[INTERVAL_PROPERTY_NAME]).forEach((key,index,value)=>{
                let k=key;
                let i = index;
                let v = value;
            });
        });
    }

    private async prepareMockData(quote: string): Promise<any> {
        try {
            let quoteMockResponse: any;
            const mockIntervals: IAlphaVantageIntervals = {};

            await this.alphaAPI.data.intraday(quote, "full", "json", "5min").then( (data: any) => {
                quoteMockResponse = data ;
            });

            Object.keys(quoteMockResponse[INTERVAL_PROPERTY_NAME]).forEach((key) => {
                if (key.includes(this.mockDataDate)) {
                  mockIntervals[key] = quoteMockResponse[INTERVAL_PROPERTY_NAME][key];
                }
            });

            this.mockDataResponseValues = Object.values(mockIntervals).reverse();
            this.mockDataResponseKeys = Object.keys(mockIntervals).reverse();

            for (let i = 0 ; i < this.currentInterval ; i++) {
                this.mockDataResponse[ INTERVAL_PROPERTY_NAME][this.mockDataResponseKeys[i]] = this.mockDataResponseValues[i];
            }

            this.mockDataResponse[METADATA_PROPERTY_NAME] = quoteMockResponse[METADATA_PROPERTY_NAME];

            this.isMockLoaded = true;

            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }

    private serveMockData(): Promise<any> {
        return new Promise ((resolve, reject) => {
            try {
                if (this.mockDataResponseKeys[this.currentInterval]) {
                    this.mockDataResponse[ INTERVAL_PROPERTY_NAME][this.mockDataResponseKeys[this.currentInterval]] =
                                                                   this.mockDataResponseValues[this.currentInterval];
                    this.mockDataResponse[ METADATA_PROPERTY_NAME ] [LAST_REFRESHED_PROPERTY_NAME] =
                                                                   this.mockDataResponseKeys[this.currentInterval];
                    this.currentInterval++;
                }
                resolve(this.mockDataResponse);
            } catch (err) {
                return reject(err);
            }
        });
    }

}
