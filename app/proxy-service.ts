/**import * as environmentConfig from "./config/environment.Config.json";

export class ProxyService {
    

    public getIntraDay:Function;
    
    private alphaAPI: any;

    private quoteIntervalsMock

    constructor(key: string, quotes: string[]= []) {
       this.alphaAPI = require("alphavantage")({ key });
       if (environmentConfig.Mock.IsMock) {
            let x: number = 9;
    } else {
            this.getIntraDay = this.alphaAPI.data.intraday;
        }
    }

}

**/