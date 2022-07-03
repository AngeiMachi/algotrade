import moment from 'moment-timezone';
import { logger } from '../config/winston.config';
import * as quoteUtiles from '../utils/quote-utils';
import { IQuoteFullIntervalData, IQuoteIntervals } from '../models/quote-data.model';
import { IQuoteMetadata } from '../models/quote-data.model';
import { MovingAverageType } from '../models/enums';
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

    constructor(quote: string, _statsDate: string = '') {
        this._quote = quote;
        if (_statsDate) {
            this._statsDate = _statsDate;
        } else {
            this._statsDate = quoteUtiles.getCurrentTradingDate();
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
        let stats = {
            quote: this.quoteName,
            interval: moment(quoteInterval.timeIsrael).format('HH:mm:ss'),
            ...quoteInterval,
            intervalNumber: this._intervalCount,
        } as any;

        if (isLive) {
            stats = { isLive: moment(new Date()).format('HH:mm:ss'), ...stats };
        }
        logger.debug(JSON.stringify(stats));
    }

    public addNewInterval(quoteInterval: IQuoteFullIntervalData, isLive: boolean = false) {
        this.quoteIntervals.push(quoteInterval);
        this._lastInterval = quoteInterval;
        this._intervalCount++;
        this._lastInterval.MA20 = this.calculateFiveMinuteMA(MovingAverageType.SMA20);
        this._lastInterval.MA50 = this.calculateFiveMinuteMA(MovingAverageType.SMA50);
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
}
