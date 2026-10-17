import * as _ from 'lodash';
import moment from 'moment-timezone';

import { IQuoteIntervals } from '../../models/quote-data.model';
import { IDailySmas } from '../race-rules/race-facts';
import { IPremarketVolumeDay, IRaceFacts } from '../race-rules/race-rule.types';
import { IWatchBar, IWatchFacts, IWatchHour } from './market-watch.types';

const NEW_YORK = 'America/New_York';
const KEY_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const PREMARKET_START = '04:00:00';

export interface IWatchFactsInput {
    quote: string;
    tradeDate: string;
    atrPct: number;
    priorDailyCloses: number[];
    dailySmas?: IDailySmas | null;
    priorHourlyCloses?: number[]; // without them the hourly SMAs are unknown
    volumeHistory?: IPremarketVolumeDay[]; // without it the relative volume is unknown
    intervals: IQuoteIntervals; // 5-minute bars keyed by New York time, any session
    sessionStart: string; // 'HH:mm', the bell
    sessionEnd: string; // 'HH:mm', the close
    dataClock: moment.Moment; // the time the data reflects; a candle ending after it is still forming
    onBoard?: boolean;
    race?: IRaceFacts | null;
}

// Today's candles as the signals read them.
export const buildWatchFacts = (input: IWatchFactsInput): IWatchFacts => {
    const from = `${input.tradeDate} ${input.sessionStart}:00`;
    const to = `${input.tradeDate} ${input.sessionEnd}:00`;
    const allBars: IWatchBar[] = Object.keys(input.intervals)
        .filter((key) => key >= `${input.tradeDate} ${PREMARKET_START}` && key < to)
        .sort()
        .map((key) => {
            const { open, high, low, close, volume } = input.intervals[key];
            return {
                key,
                time: key.substring(11, 16),
                open,
                high,
                low,
                close,
                volume,
                forming: moment.tz(key, KEY_FORMAT, NEW_YORK).add(5, 'minutes').isAfter(input.dataClock),
            };
        });
    const bars = allBars.filter((bar) => bar.key >= from);

    return {
        quote: input.quote,
        tradeDate: input.tradeDate,
        atrPct: input.atrPct,
        priorDailyCloses: input.priorDailyCloses,
        dailySmas: input.dailySmas ?? null,
        priorHourlyCloses: input.priorHourlyCloses || [],
        volumeHistory: input.volumeHistory || [],
        hours: buildHours(input, allBars),
        allBars,
        openingPrice: bars.length > 0 && bars[0].key === from ? bars[0].open : null,
        bars,
        onBoard: !!input.onBoard,
        race: input.race ?? null,
    };
};

// Today's hourly candles from 04:00 to the last bar, like the race's 24-hour chart.
const buildHours = (input: IWatchFactsInput, allBars: IWatchBar[]): IWatchHour[] => {
    if (allBars.length === 0) {
        return [];
    }
    const barsByHour = _.groupBy(allBars, (bar) => bar.time.substring(0, 2));
    let previousClose = _.last(input.priorHourlyCloses) ?? allBars[0].open;
    return _.range(4, Number(_.last(allBars)!.time.substring(0, 2)) + 1).map((hourNumber) => {
        const hour = String(hourNumber).padStart(2, '0');
        const hourBars = barsByHour[hour];
        previousClose = hourBars ? _.last(hourBars)!.close : previousClose;
        const hourEnd = moment.tz(`${input.tradeDate} ${hour}:00:00`, KEY_FORMAT, NEW_YORK).add(1, 'hour');
        return {
            hour,
            low: hourBars ? _.minBy(hourBars, 'low')!.low : previousClose,
            close: previousClose,
            complete: !hourEnd.isAfter(input.dataClock),
            traded: !!hourBars,
        };
    });
};
