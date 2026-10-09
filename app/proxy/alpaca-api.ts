import * as _ from 'lodash';
import moment from 'moment-timezone';
import * as request from 'request-promise';
import Bottleneck from 'bottleneck';

import * as environmentConfig from '../config/environment.Config.json';
import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';

import * as convertUtils from '../utils/convert-utils';
import * as quoteUtils from '../utils/quote-utils';

import { IQuoteHistoricalIntervals, IQuoteIntervals, ITDAmeritradeIntervalData, ITDAmeritradePriceHistory } from '../models/quote-data.model';

const NEW_YORK = 'America/New_York';
const EXTENDED_SESSION_START = '04:00';
const EXTENDED_SESSION_END = '20:00';
const REGULAR_SESSION_START = '09:30';
const REGULAR_SESSION_END = '16:00';

// The free data plan serves SIP (all exchanges) only for data older than 15 minutes; newer data comes from IEX alone.
const SIP_DELAY_MINUTES = 16;
// IEX carries ~2-4% of US volume, so live IEX volume is scaled up per symbol by the SIP/IEX ratio of recent bars.
const DEFAULT_IEX_VOLUME_MULTIPLIER = 30;
const MIN_BARS_FOR_VOLUME_MULTIPLIER = 12;

const BATCH_WINDOW_MS = 20;
const MAX_SYMBOLS_PER_REQUEST = 100;
const MAX_BARS_PER_PAGE = 10000;

// boats = Blue Ocean ATS, the venue behind the 20:00-04:00 overnight session that 24-hour charts include.
type Feed = 'sip' | 'iex' | 'boats';

interface IAlpacaBar {
    t: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

interface IBarsQuery {
    timeframe: string;
    start: string;
    end?: string;
    feed: Feed;
}

interface IBarsWaiter {
    resolve: (bars: IAlpacaBar[]) => void;
    reject: (err: any) => void;
}

const limiter = new Bottleneck({
    reservoir: 190, // free plan allows 200 requests per minute
    reservoirRefreshAmount: 190,
    reservoirRefreshInterval: 60 * 1000,
    maxConcurrent: 10,
    minTime: 0,
});

const quotesPulledFirstPremarket: { [key: string]: boolean } = {};
const iexVolumeMultipliers: { [key: string]: number } = {};
const pendingBatches = new Map<string, { query: IBarsQuery; waiters: Map<string, IBarsWaiter[]> }>();

export const getQuote5MinuteHistory = async (quote: string, specificTradeDates: string[] = []): Promise<IQuoteHistoricalIntervals> => {
    try {
        const symbol = quote.toUpperCase();
        const tradingDate = quoteUtils.getCurrentTradingDate();
        const startDate = moment(tradingDate).subtract(1, 'month').format('YYYY-MM-DD');

        const bars = await get5MinuteBars(symbol, nyTime(startDate, REGULAR_SESSION_START), nyTime(tradingDate, REGULAR_SESSION_END));
        const candles = bars.filter((bar) => isInSession(bar, false)).map(toCandle);

        let groupedIntervalsByDay = _.groupBy(candles, (candle) => moment(candle.datetime).tz(NEW_YORK).format('YYYY-MM-DD'));

        if (specificTradeDates.length > 0) {
            groupedIntervalsByDay = _.pick(groupedIntervalsByDay, specificTradeDates);
        }

        groupedIntervalsByDay = _.omitBy(groupedIntervalsByDay, (intervals) => intervals.length !== 78);

        return convertUtils.convertTDAmeritradeMultipleDaysOf5MinuteIntervals(groupedIntervalsByDay);
    } catch (err) {
        logger.error('getQuote5MinuteHistory failed ' + err);
        throw err;
    }
};

export const getQuote5MinuteIntraday = async (quote: string, tradeDate: string, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        const symbol = quote.toUpperCase();
        const startDate = quotesPulledFirstPremarket[symbol] ? tradeDate : (quoteUtils.getPreviousTradingDate(tradeDate) as string);

        const bars = await get5MinuteBars(symbol, nyTime(startDate, EXTENDED_SESSION_START), nyTime(tradeDate, EXTENDED_SESSION_END));
        quotesPulledFirstPremarket[symbol] = true;

        return convertUtils.convertTDAmeritrade5MinuteIntervals(bars.filter((bar) => isInSession(bar, getExtendedHours)).map(toCandle));
    } catch (err) {
        logger.error('getQuote5MinuteIntraday failed ' + err);
        throw err;
    }
};

// Historical only (SIP): the replay uses these to rebuild 5-minute candles minute by minute.
export const getQuote1MinuteIntraday = async (quote: string, tradeDate: string, fromTime: string, toTime: string): Promise<IQuoteIntervals> => {
    const symbol = quote.toUpperCase();
    const from = nyTime(tradeDate, fromTime);
    const to = nyTime(tradeDate, toTime);
    const bars = await getBars(symbol, { timeframe: '1Min', start: from.toISOString(), end: to.toISOString(), feed: 'sip' });
    return convertUtils.convertTDAmeritrade5MinuteIntervals(bars.filter((bar) => moment(bar.t).isBefore(to)).map(toCandle));
};

export const getQuote5MinuteMultipleDays = async (quote: string, tradeDate: string, daysBack: number = 0, getExtendedHours: boolean = true): Promise<IQuoteIntervals> => {
    try {
        const symbol = quote.toUpperCase();
        const startDate = moment(tradeDate).subtract(daysBack, 'days').format('YYYY-MM-DD');

        const bars = await get5MinuteBars(symbol, nyTime(startDate, EXTENDED_SESSION_START), nyTime(tradeDate, EXTENDED_SESSION_END));

        return convertUtils.convertTDAmeritrade5MinuteIntervals(bars.filter((bar) => isInSession(bar, getExtendedHours)).map(toCandle));
    } catch (err) {
        logger.error('getQuote5MinuteMultipleDays failed ' + err);
        throw err;
    }
};

export const getQuoteFullYearDailyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const symbol = quote.toUpperCase();
        const tradingDate = quoteUtils.getCurrentTradingDate();

        const bars = await getBars(symbol, {
            timeframe: '1Day',
            start: moment.tz(tradingDate, NEW_YORK).subtract(1, 'year').toISOString(),
            end: endOfPreviousDay(tradingDate).toISOString(),
            feed: 'sip',
        });

        return toPriceHistory(symbol, bars.map(toDayCandle));
    } catch (err) {
        logger.error('getQuoteFullYearDailyHistory failed ' + err);
        throw err;
    }
};

export const getQuoteFullYearWeeklyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const symbol = quote.toUpperCase();
        const tradingDate = quoteUtils.getCurrentTradingDate();

        const bars = await getBars(symbol, {
            timeframe: '1Week',
            start: moment.tz(tradingDate, NEW_YORK).subtract(1, 'year').toISOString(),
            end: endOfPreviousDay(tradingDate).toISOString(),
            feed: 'sip',
        });

        return toPriceHistory(symbol, bars.map(toDayCandle));
    } catch (err) {
        logger.error('getQuoteFullYearWeeklyHistory failed ' + err);
        throw err;
    }
};

export const getQuoteHourlyHistory = async (quote: string): Promise<ITDAmeritradePriceHistory> => {
    try {
        const symbol = quote.toUpperCase();
        const tradingDate = quoteUtils.getCurrentTradingDate();
        const end = globalConfig.Mock.IsMock ? endOfPreviousDay(tradingDate) : sipCutoff();

        const bars = await getBars(symbol, {
            timeframe: '1Hour',
            start: moment.tz(tradingDate, NEW_YORK).subtract(16, 'days').toISOString(),
            end: end.toISOString(),
            feed: 'sip',
        });

        const completeBars = bars.filter((bar) => isInSession(bar, true) && !moment(bar.t).add(1, 'hour').isAfter(end));
        const lastTenTradingDates = _.takeRight(_.uniq(completeBars.map(nyDate)), 10);
        const candles = completeBars.filter((bar) => lastTenTradingDates.includes(nyDate(bar))).map(toCandle);

        return toPriceHistory(symbol, candles);
    } catch (err) {
        logger.error('getQuoteHourlyHistory failed ' + err);
        throw err;
    }
};

// Round-the-clock hourly candles that end where tradeDate's premarket begins, matching a 24-hour broker chart.
// ~24 candles per weekday, so 21 calendar days comfortably covers a 200-hour SMA.
export const getQuote24HourHourlyHistory = async (quote: string, tradeDate: string, calendarDaysBack: number = 21): Promise<ITDAmeritradePriceHistory> => {
    try {
        const symbol = quote.toUpperCase();
        const query = {
            timeframe: '1Hour',
            start: moment.tz(tradeDate, NEW_YORK).subtract(calendarDaysBack, 'days').toISOString(),
            end: nyTime(tradeDate, EXTENDED_SESSION_START).subtract(1, 'second').toISOString(),
        };

        const [sipBars, overnightBars] = await Promise.all([
            getBars(symbol, { ...query, feed: 'sip' }),
            getBars(symbol, { ...query, feed: 'boats' }),
        ]);

        const candles = _.sortBy(
            [...sipBars.filter((bar) => isInSession(bar, true)), ...overnightBars.filter((bar) => !isInSession(bar, true))],
            't'
        ).map(toCandle);

        const tradingDates = new Set([...sipBars.map(nyDate), tradeDate]);
        return toPriceHistory(symbol, fillEmptyHours(candles, tradingDates));
    } catch (err) {
        logger.error('getQuote24HourHourlyHistory failed ' + err);
        throw err;
    }
};

// The broker chart has a candle for every hour of the 24-hour session, carrying the last close through hours with
// no trades (common overnight for thinner stocks). Without them a 200-hour SMA reaches days further back and drifts
// from the chart. The 20:00-04:00 overnight belongs to the next trading day, so weekends and holidays stay empty.
const fillEmptyHours = (candles: ITDAmeritradeIntervalData[], tradingDates: Set<string>): ITDAmeritradeIntervalData[] => {
    if (candles.length === 0) {
        return candles;
    }
    const byHour = new Map(candles.map((candle) => [candle.datetime, candle] as [number, ITDAmeritradeIntervalData]));
    const filled: ITDAmeritradeIntervalData[] = [];
    let previous = candles[0];

    for (let hour = moment(candles[0].datetime); !hour.isAfter(moment(candles[candles.length - 1].datetime)); hour.add(1, 'hour')) {
        const candle = byHour.get(hour.valueOf());
        if (candle) {
            filled.push(candle);
            previous = candle;
        } else if (tradingDates.has(sessionDateOf(hour))) {
            const { close } = previous;
            filled.push({ open: close, high: close, low: close, close, volume: 0, datetime: hour.valueOf() });
        }
    }
    return filled;
};

const sessionDateOf = (hour: moment.Moment) => {
    const newYork = hour.clone().tz(NEW_YORK);
    return (newYork.format('HH:mm') >= EXTENDED_SESSION_END ? newYork.add(1, 'day') : newYork).format('YYYY-MM-DD');
};

export const getMarketHours = async (tradeDate: string): Promise<any> => {
    return limiter.schedule(() =>
        request.get({
            url: `${environmentConfig.Alpaca.tradingUrl}/calendar`,
            headers: authHeaders(),
            qs: { start: tradeDate, end: tradeDate },
            json: true,
        })
    );
};

const get5MinuteBars = async (symbol: string, start: moment.Moment, end: moment.Moment): Promise<IAlpacaBar[]> => {
    const cutoff = sipCutoff();

    if (!end.isAfter(cutoff)) {
        return getBars(symbol, { timeframe: '5Min', start: start.toISOString(), end: end.toISOString(), feed: 'sip' });
    }

    const [sipBars, iexBars] = await Promise.all([
        start.isBefore(cutoff)
            ? getBars(symbol, { timeframe: '5Min', start: start.toISOString(), end: cutoff.toISOString(), feed: 'sip' })
            : Promise.resolve([] as IAlpacaBar[]),
        getBars(symbol, { timeframe: '5Min', start: start.toISOString(), feed: 'iex' }),
    ]);

    const completeSipBars = sipBars.filter((bar) => !moment(bar.t).add(5, 'minutes').isAfter(cutoff));

    return mergeLiveIexBars(symbol, completeSipBars, iexBars);
};

const mergeLiveIexBars = (symbol: string, sipBars: IAlpacaBar[], iexBars: IAlpacaBar[]): IAlpacaBar[] => {
    const sipVolumeByTime = new Map(sipBars.map((bar) => [bar.t, bar.v] as [string, number]));
    const overlappingIexBars = iexBars.filter((bar) => sipVolumeByTime.has(bar.t));
    const overlappingIexVolume = _.sumBy(overlappingIexBars, 'v');

    if (overlappingIexBars.length >= MIN_BARS_FOR_VOLUME_MULTIPLIER && overlappingIexVolume > 0) {
        iexVolumeMultipliers[symbol] = _.sumBy(overlappingIexBars, (bar) => sipVolumeByTime.get(bar.t) as number) / overlappingIexVolume;
    }

    const multiplier = iexVolumeMultipliers[symbol] || DEFAULT_IEX_VOLUME_MULTIPLIER;
    const lastSipTime = sipBars.length > 0 ? sipBars[sipBars.length - 1].t : '';
    const liveBars = iexBars.filter((bar) => bar.t > lastSipTime).map((bar) => ({ ...bar, v: Math.round(bar.v * multiplier) }));

    return [...sipBars, ...liveBars];
};

// Requests with identical parameters issued within BATCH_WINDOW_MS are merged into multi-symbol calls.
const getBars = (symbol: string, query: IBarsQuery): Promise<IAlpacaBar[]> => {
    const batchKey = JSON.stringify(query);
    let batch = pendingBatches.get(batchKey);

    if (!batch) {
        batch = { query, waiters: new Map() };
        pendingBatches.set(batchKey, batch);
        setTimeout(() => flushBatch(batchKey), BATCH_WINDOW_MS);
    }

    const waiters = batch.waiters;
    return new Promise((resolve, reject) => {
        waiters.set(symbol, [...(waiters.get(symbol) || []), { resolve, reject }]);
    });
};

const flushBatch = async (batchKey: string) => {
    const batch = pendingBatches.get(batchKey);
    pendingBatches.delete(batchKey);
    if (!batch) {
        return;
    }

    const symbolChunks = _.chunk(Array.from(batch.waiters.keys()), MAX_SYMBOLS_PER_REQUEST);

    await Promise.all(
        symbolChunks.map(async (symbols) => {
            try {
                const barsBySymbol = await fetchBars(symbols, batch.query);
                symbols.forEach((symbol) => batch.waiters.get(symbol)?.forEach((waiter) => waiter.resolve(barsBySymbol[symbol] || [])));
            } catch (err) {
                symbols.forEach((symbol) => batch.waiters.get(symbol)?.forEach((waiter) => waiter.reject(err)));
            }
        })
    );
};

const fetchBars = async (symbols: string[], query: IBarsQuery): Promise<{ [key: string]: IAlpacaBar[] }> => {
    const barsBySymbol: { [key: string]: IAlpacaBar[] } = {};
    let pageToken: string | undefined;

    do {
        const response = await limiter.schedule(() =>
            request.get({
                url: `${environmentConfig.Alpaca.dataUrl}/stocks/bars`,
                headers: authHeaders(),
                qs: {
                    ...query,
                    symbols: symbols.join(','),
                    adjustment: 'split',
                    limit: MAX_BARS_PER_PAGE,
                    page_token: pageToken,
                },
                json: true,
            })
        );

        for (const [symbol, bars] of Object.entries((response.bars || {}) as { [key: string]: IAlpacaBar[] })) {
            barsBySymbol[symbol] = (barsBySymbol[symbol] || []).concat(bars);
        }
        pageToken = response.next_page_token || undefined;
    } while (pageToken);

    return barsBySymbol;
};

const authHeaders = () => {
    const keyId = process.env.ALPACA_KEY_ID;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    if (!keyId || !secretKey) {
        throw 'ALPACA_KEY_ID / ALPACA_SECRET_KEY are missing from .env';
    }
    return { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secretKey };
};

const sipCutoff = () => moment().subtract(SIP_DELAY_MINUTES, 'minutes').startOf('minute');

const nyTime = (date: string, time: string) => moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', NEW_YORK);

const nyDate = (bar: IAlpacaBar) => moment(bar.t).tz(NEW_YORK).format('YYYY-MM-DD');

const endOfPreviousDay = (tradingDate: string) => moment.tz(tradingDate, NEW_YORK).subtract(1, 'second');

const isInSession = (bar: IAlpacaBar, getExtendedHours: boolean) => {
    const time = moment(bar.t).tz(NEW_YORK).format('HH:mm');
    return getExtendedHours
        ? time >= EXTENDED_SESSION_START && time < EXTENDED_SESSION_END
        : time >= REGULAR_SESSION_START && time < REGULAR_SESSION_END;
};

const toCandle = (bar: IAlpacaBar): ITDAmeritradeIntervalData => ({
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    datetime: moment(bar.t).valueOf(),
});

// quote-utils locates daily/weekly candles by TD's timestamp convention: midnight US Central of the candle's date.
const toDayCandle = (bar: IAlpacaBar): ITDAmeritradeIntervalData => ({
    ...toCandle(bar),
    datetime: moment.tz(nyDate(bar), 'America/Chicago').valueOf(),
});

const toPriceHistory = (symbol: string, candles: ITDAmeritradeIntervalData[]): ITDAmeritradePriceHistory => ({
    candles,
    symbol,
    empty: candles.length === 0,
});

limiter.on('failed', (error: any, jobInfo) => {
    const status = error?.statusCode;
    logger.error(`Alpaca API call failed (status ${status}): ${error?.message || error}`);

    if ((status === undefined || status === 429 || status >= 500) && jobInfo.retryCount < 3) {
        logger.info(`Retrying Alpaca API call in 5 seconds (try #${jobInfo.retryCount + 1})...`);
        return 5000;
    }
});
