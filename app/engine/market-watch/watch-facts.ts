import * as _ from 'lodash';
import moment from 'moment-timezone';

import { IQuoteIntervals } from '../../models/quote-data.model';
import { IWatchBar, IWatchFacts, IWatchHour } from './market-watch.types';

const NEW_YORK = 'America/New_York';
const KEY_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const PREMARKET_START = '04:00:00';

export interface IWatchFactsInput {
    quote: string;
    tradeDate: string;
    atrPct: number;
    priorDailyCloses: number[];
    priorHourlyCloses?: number[]; // without them the hourly SMAs are unknown
    intervals: IQuoteIntervals; // 5-minute bars keyed by New York time, any session
    sessionStart: string; // 'HH:mm', the bell
    sessionEnd: string; // 'HH:mm', the close
    dataClock: moment.Moment; // the time the data reflects; a candle ending after it is still forming
}

// Today's regular-session candles as the signals read them.
export const buildWatchFacts = (input: IWatchFactsInput): IWatchFacts => {
    const from = `${input.tradeDate} ${input.sessionStart}:00`;
    const to = `${input.tradeDate} ${input.sessionEnd}:00`;
    const bars: IWatchBar[] = Object.keys(input.intervals)
        .filter((key) => key >= from && key < to)
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

    return {
        quote: input.quote,
        tradeDate: input.tradeDate,
        atrPct: input.atrPct,
        priorDailyCloses: input.priorDailyCloses,
        priorHourlyCloses: input.priorHourlyCloses || [],
        hours: buildHours(input),
        openingPrice: bars.length > 0 && bars[0].key === from ? bars[0].open : null,
        bars,
    };
};

// Today's hourly candles from 04:00 to the last bar, like the race's 24-hour chart.
const buildHours = (input: IWatchFactsInput): IWatchHour[] => {
    const keys = Object.keys(input.intervals)
        .filter((key) => key >= `${input.tradeDate} ${PREMARKET_START}` && key.startsWith(input.tradeDate))
        .sort();
    if (keys.length === 0) {
        return [];
    }
    const keysByHour = _.groupBy(keys, (key) => key.substring(11, 13));
    let previousClose = _.last(input.priorHourlyCloses) ?? input.intervals[keys[0]].open;
    return _.range(4, Number(_.last(keys)!.substring(11, 13)) + 1).map((hourNumber) => {
        const hour = String(hourNumber).padStart(2, '0');
        const hourKeys = keysByHour[hour];
        previousClose = hourKeys ? input.intervals[_.last(hourKeys) as string].close : previousClose;
        const hourEnd = moment.tz(`${input.tradeDate} ${hour}:00:00`, KEY_FORMAT, NEW_YORK).add(1, 'hour');
        return { hour, close: previousClose, complete: !hourEnd.isAfter(input.dataClock) };
    });
};
