import * as _ from 'lodash';
import moment from 'moment-timezone';
import { logger } from '../config/winston.config';
import * as quoteUtils from '../utils/quote-utils';
import { IQuoteFullIntervalData, IQuoteIntervals } from '../models/quote-data.model';
import { IQuoteMetadata } from '../models/quote-data.model';
import { MovingAverageType } from '../models/enums';
import * as globalConfig from '../config/globals.config';
import * as quoteState from './state';
export class QuoteStatistics {
    private _quote: string;
    public get quoteName() {
        return this._quote;
    }

    private _statsDate: string;
    public get statsDay() {
        return this._statsDate;
    }

    private _quoteIntervals: IQuoteFullIntervalData[] = [];
    public get quoteIntervals() {
        return this._quoteIntervals;
    }

    private _intervalCount: number = -1;
    public get intervalCount() {
        return this._intervalCount;
    }

    private _lastInterval: IQuoteFullIntervalData = {} as IQuoteFullIntervalData;
    public get lastInterval() {
        return this._lastInterval;
    }

    public get previousInterval() {
        return this._quoteIntervals[this.quoteIntervals.length-2];
    }

    private _metadata: IQuoteMetadata = {} as IQuoteMetadata;
    public get metadata() {
        return this._metadata;
    }

    private get isFirstInterval() {
        return this._intervalCount===0;
    }

    private hourlyHistoryIndexStart=-1;
    private hourlyClose:number[]=[];
    public hourlyMA20:number[]=[];
    public hourlyMA50:number[]=[];
    public hourlyMA20Last:number=1000000;
    public hourlyMA50Last:number=1000000;

    constructor(quote: string, _statsDate: string = '') {
        this._quote = quote;
        if (_statsDate) {
            this._statsDate = _statsDate;
        } else {
            this._statsDate = quoteUtils.getCurrentTradingDate();
        }
    }

    public getLastInterval() {
        return this._quoteIntervals[this.intervalCount];
    }

    public initializeStockIntervalsSoFar(quoteIntervals: IQuoteIntervals) {
        let intervalKeys = Object.keys(quoteIntervals).filter((key) => key.includes(this._statsDate));
        if (intervalKeys.length > 0) {
            // patch fix to handles a bug - different behavior between real data and mock
            // if (intervalKeys[0].includes('16:00:00') || !intervalKeys[0].includes('09:35:00')) {
            //     intervalKeys = intervalKeys.reverse();
            // }
            intervalKeys.forEach((key) => {
                if (key.includes(this._statsDate)) {
                    this.quoteIntervals.push(quoteIntervals[key]);
                    this._lastInterval = quoteIntervals[key];
                }
            });
        }
    }

    public registerMetadata(metadata: IQuoteMetadata) {
        this._metadata = metadata;
    }

    public composeAndPrintCurrentIntervalStats(quoteInterval: IQuoteFullIntervalData, isLive: boolean) {
        if (quoteUtils.isIntervalOfCurrentTradingDate(quoteInterval)) {
            let stats = {
                quote: this.quoteName,
                interval: moment(quoteInterval.timeIsrael).format('HH:mm:ss'),
                ...quoteInterval,
                timeNewYork: quoteInterval.timeNewYork.toString(),
                timeIsrael: quoteInterval.timeIsrael.toString(),
                intervalNumber: this._intervalCount,
            } as any;
    
            if (isLive) {
                stats = { isLive: moment(new Date()).format('HH:mm:ss'), ...stats };
            }
            const preMarket = quoteUtils.isPremarketTimeByInterval(quoteInterval) ? 'Premarket :':'';
            console.debug('════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════');
            logger.debug(`${preMarket}${JSON.stringify(stats)}`);
        }
    }

    public addNewInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false) {
        if (quoteUtils.isPremarketTimeByInterval(quoteInterval)){
            this.addPremarketMetadata(quoteInterval)
            this._lastInterval= quoteInterval;
        } else {
            this._intervalCount++;
            quoteInterval.intervalNumber=this._intervalCount;
            this.quoteIntervals.push(quoteInterval);
            this._lastInterval = quoteInterval;
            

            if (this.isFirstInterval) {
                this.hourlyHistoryIndexStart =this.findIndexOfFirstHorly();
                this.composeMetadata();
            }
            
            this._lastInterval.MA10 = this.calculateFiveMinuteMA(MovingAverageType.SMA10);
            this._lastInterval.MA20 = this.calculateFiveMinuteMA(MovingAverageType.SMA20);
            this._lastInterval.MA50 = this.calculateFiveMinuteMA(MovingAverageType.SMA50);
            this.processHourlyStatistics();
        }
    }
        

    private calculateFiveMinuteMA(MA:MovingAverageType) {
        let sum=0;
        let i;
        for ( i=0;i<this._quoteIntervals.length;i++) {
            sum+=this._quoteIntervals[this._quoteIntervals.length-1-i].close;
            if (i===MA-1) return sum/MA;
        }

        const intervalsKeysArr = Object.keys(this._metadata.preMarketMetadata?.preMarketIntervals as IQuoteIntervals);

        for (let j=0;j<intervalsKeysArr.length;j++) {
            sum+=(this._metadata.preMarketMetadata?.preMarketIntervals[intervalsKeysArr[intervalsKeysArr.length-1-j]] as IQuoteFullIntervalData).close;
            if (i===MA-1) return sum/MA;
            i++ 
        }

        return 0;
    }
    private calculate60MinutesMA(MA:MovingAverageType,offset:number=0) {
        const maLessPremarket = MA-3;
        let sum=0;
        let i;
        for (i=0;i<this.hourlyClose.length-offset;i++) {
            sum+=this.hourlyClose[this.hourlyClose.length-1-i-offset];
        }
        const premarketCloseIntervals =this.metadata.preMarketMetadata?.premarketCloseIntervals || [];
        for (let k=0;k<premarketCloseIntervals.length-offset;k++) {
            sum+=premarketCloseIntervals[premarketCloseIntervals.length-k-1-offset].close || 0;
            if (i===maLessPremarket-1) return sum/maLessPremarket;
            i++;
        }
        for (let j=0;j<this._metadata.hourlyHistory.length-offset;j++) {
            sum+=this._metadata.hourlyHistory[this.hourlyHistoryIndexStart-j-offset]?.close;
            if (i===maLessPremarket-1) return sum/maLessPremarket;
            i++;
        }
        
        return 0;

    }
    private processHourlyStatistics() {
        const  time = quoteUtils.getMarketHours();
        const timediff= moment(this._lastInterval.timeNewYork).diff(time.sessionHours.regularMarket.start, 'minutes'); 
        if (this._intervalCount===0) {
            this.hourlyMA20.push(this.calculate60MinutesMA(MovingAverageType.SMA20,1));
            this.hourlyMA20Last=this.calculate60MinutesMA(MovingAverageType.SMA20);
            this.hourlyMA20.push(this.hourlyMA20Last);
            this.hourlyMA50.push(this.calculate60MinutesMA(MovingAverageType.SMA50,1));
            this.hourlyMA50Last =this.calculate60MinutesMA(MovingAverageType.SMA50);
            this.hourlyMA50.push(this.hourlyMA50Last);
        }
        if (timediff===25 || timediff % 60===25) {
            this.hourlyClose.push(this._lastInterval.close);
            this.hourlyMA20.push(this.calculate60MinutesMA(MovingAverageType.SMA20));
            this.hourlyMA50.push(this.calculate60MinutesMA(MovingAverageType.SMA50));
        }   
    }
    private findIndexOfFirstHorly() {
        if (globalConfig.Mock.IsMock) {
            let time = quoteUtils.getMarketHours().sessionHours.postMarket.end;
            const date = time.substring(0,10);
            const previousTradingdate =quoteUtils.getPreviousTradingDate(date).toString();
            time =time.substring(0,14)+'0'+time.substring(15);
            time =previousTradingdate+' '+ (+(time[11]+time[12])-1) + time.substring(12+1);
            const timeStr = moment(time).toDate().toString().slice(0,24);
            const previousTradingdateStr = timeStr.substring(0,15);
            return _.findLastIndex(this._metadata.hourlyHistory,(interval)=>{
                    return interval.timeNewYork.toString().includes(previousTradingdateStr);
            });
        } 

        return this._metadata.hourlyHistory.length-1;
        
    }
    private composeMetadata() {
        const dailyHistoricalData = this.metadata.fullYearDailyHistory;
        this.metadata.SMA5.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 5, this.lastInterval);
        this.metadata.SMA10.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 10, this.lastInterval);
        this.metadata.SMA20.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 20, this.lastInterval);
        this.metadata.SMA50.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 50, this.lastInterval);
        this.metadata.SMA100.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 100, this.lastInterval);
        this.metadata.SMA200.today = quoteUtils.calculateMovingAverage(dailyHistoricalData, this.statsDay, 200, this.lastInterval);
        
        this.metadata.SMA5.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA5.today);
        this.metadata.SMA10.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA10.today);
        this.metadata.SMA20.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA20.today);
        this.metadata.SMA50.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA50.today);
        this.metadata.SMA100.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA100.today);
        this.metadata.SMA200.didOpenOboveSMA = quoteUtils.isAboveMovingAverage(this.lastInterval, this.metadata.SMA200.today);

        quoteState.initSmaData(this.quoteName);
    }

    private addPremarketMetadata(quoteInterval: IQuoteFullIntervalData) {
        let maxHigh = this.metadata.preMarketMetadata?.preMarketHOD?.high || 0;
        let minLow = this.metadata.preMarketMetadata?.preMarketLOD?.high || 10000;

        const propertyName =moment(quoteInterval.timeNewYork).format('YYYY-MM-DD HH:mm:ss').toString();
        
        this.metadata.preMarketMetadata.preMarketIntervals[propertyName]=quoteInterval;
        
        if (quoteUtils.isIntervalOfCurrentTradingDate(propertyName)) {
            if (quoteInterval.high > maxHigh) {
                this.metadata.preMarketMetadata.preMarketHOD = quoteInterval;
            }
            if (quoteInterval.low<minLow) {
                this.metadata.preMarketMetadata.preMarketLOD = quoteInterval;
            }
    
            if (propertyName.includes(':55:00')) {
                this.metadata.preMarketMetadata.premarketCloseIntervals.push(quoteInterval);
            }
        }
    }
}
