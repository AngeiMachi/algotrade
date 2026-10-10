import moment from 'moment-timezone';

import { IQuoteIntervals } from '../../models/quote-data.model';
import { IWatchBar, IWatchFacts } from './market-watch.types';

const NEW_YORK = 'America/New_York';
const KEY_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export interface IWatchFactsInput {
    quote: string;
    tradeDate: string;
    atrPct: number;
    priorDailyCloses: number[];
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
        openingPrice: bars.length > 0 && bars[0].key === from ? bars[0].open : null,
        bars,
    };
};
