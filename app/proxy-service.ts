import moment from "moment-timezone";
import * as environmentConfig from "./config/environment.Config.json";
import { INTERVAL_PROPERTY_NAME , METADATA_PROPERTY_NAME , MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME} from "./config/globals.config";
import { IAlphaVantageIntervals } from "./models/stock-interval-data.model";

export class ProxyService {

    private alphaAPI: any;

    private mockDataResponse: any = {};
    private mockDataResponseValues: any[];
    private mockDataResponseKeys: any[];
    private currentInterval: number ;
    private todayDate: string ;
    private isMockLoaded: boolean;

    constructor(key: string) {
       this.alphaAPI = require("alphavantage")({ key });
       this.currentInterval = MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME;
       this.isMockLoaded = false;

       this.mockDataResponse[INTERVAL_PROPERTY_NAME] = {};
       this.mockDataResponse[METADATA_PROPERTY_NAME] = {};
       this.mockDataResponseValues = [];
       this.mockDataResponseKeys = [];

       this.todayDate = "2019-06-28";
       //this.todayDate = moment(new Date()).format("YYYY-MM-DD");
    }

    private async getIntraday(quote: string): Promise< any > {
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

    private async prepareMockData(quote: string): Promise<any> {
        try {
            let quoteMockResponse: any;
            const mockIntervals: IAlphaVantageIntervals = {};

            await this.alphaAPI.data.intraday(quote, "compact", "json", "5min").then( (data: any) => {
                quoteMockResponse = data ;
            });

            Object.keys(quoteMockResponse[INTERVAL_PROPERTY_NAME]).reverse().forEach((key) => {
                if (key.includes(this.todayDate)) {
                  mockIntervals[key] = quoteMockResponse[INTERVAL_PROPERTY_NAME][key];
                }
            });

            this.mockDataResponseValues = Object.values(mockIntervals);
            this.mockDataResponseKeys = Object.keys(mockIntervals);

            for (let i = 0 ; i < this.currentInterval ; i++) {
                this.mockDataResponse[ INTERVAL_PROPERTY_NAME][this.mockDataResponseKeys[i]] = this.mockDataResponseValues[i];
            }

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
                    this.mockDataResponse[ METADATA_PROPERTY_NAME ] ["3. Last Refreshed"] = this.mockDataResponseKeys[this.currentInterval];

                    this.currentInterval++;
                }
                resolve(this.mockDataResponse);
            } catch (err) {
                return reject(err);
            }
        });
    }

}
