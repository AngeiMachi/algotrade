import * as _ from 'lodash';
import moment from 'moment-timezone';

import { MarketWatchConfig } from '../../config/market-watch.config';
import { logger } from '../../config/winston.config';
import * as quoteUtils from '../../utils/quote-utils';
import * as clientService from '../../proxy/client-service';
import * as proxyService from '../../proxy/proxy-service';
import { IQuoteIntervals } from '../../models/quote-data.model';
import { IMarketAlert, IWatchStatus } from './market-watch.types';
import { watchSignals } from './signals';
import { buildWatchFacts } from './watch-facts';

// Follows the race's stocks through the regular session, runs every signal on each update and keeps the day's
// alerts: the notification center. New alerts are pushed to the board as `marketAlert`; the whole state as
// `marketWatchUpdate`.

const RECOMPUTE_INTERVAL_MS = 300;

export interface IWatchedStock {
    atrPct: number;
    priorDailyCloses: number[]; // daily closes before today, oldest first
    intervals: IQuoteIntervals;
}

export interface IMarketWatchState {
    tradeDate: string;
    clockIso: string;
    sessionOpen: boolean;
    signals: { id: string; title: string; description: string }[];
    watching: IWatchStatus[];
    alerts: IMarketAlert[]; // newest first
}

// Sent with each new alert. Live = recent enough on the data clock to pop up; older ones (rebuilt after a restart)
// only join the notification center.
export interface IMarketAlertEvent {
    alert: IMarketAlert;
    live: boolean;
}

const stocks: { [quote: string]: IWatchedStock } = {};
const alerts = new Map<string, IMarketAlert>();
let state: IMarketWatchState | null = null;
let recomputeTimer: NodeJS.Timeout | null = null;

export const track = (quote: string, stock: IWatchedStock) => {
    stocks[quote] = stock;
    scheduleRecompute();
};

export const updateQuote = (quote: string, intervals: IQuoteIntervals) => {
    if (!stocks[quote] || !intervals) {
        return;
    }
    stocks[quote].intervals = intervals;
    scheduleRecompute();
};

export const getState = (): IMarketWatchState => state ?? computeState().state;

// Stocks some signal is waiting on right now: their forming candle is worth refreshing.
export const getArmedQuotes = (): string[] => (state?.watching || []).filter((status) => status.state === 'Armed').map((status) => status.quote);

export const describeSignals = () => watchSignals.map((signal) => ({ id: signal.id, title: signal.title, description: signal.describe() }));

const scheduleRecompute = () => {
    if (recomputeTimer) {
        return;
    }
    recomputeTimer = setTimeout(() => {
        recomputeTimer = null;
        try {
            const { state: next, newAlerts } = computeState();
            state = next;
            const clock = proxyService.getDataClock();
            newAlerts.forEach((alert) => {
                const ageMinutes = clock.diff(moment(alert.timeIso).add(5, 'minutes'), 'minutes', true);
                const event: IMarketAlertEvent = { alert, live: ageMinutes <= MarketWatchConfig.liveAlertMinutes };
                logger.info(`market-watch ${event.live ? 'alert' : 'past alert'} ${alert.quote} ${alert.candle}: ${alert.title}`);
                clientService.emitMarketAlert(event);
            });
            clientService.emitMarketWatchUpdate(next);
        } catch (err) {
            logger.error('market-watch recompute failed ' + err);
        }
    }, RECOMPUTE_INTERVAL_MS);
};

const computeState = (): { state: IMarketWatchState; newAlerts: IMarketAlert[] } => {
    const tradeDate = quoteUtils.getCurrentTradingDate();
    const regularMarket = quoteUtils.getMarketHours()?.sessionHours?.regularMarket;
    const sessionStart = (regularMarket?.start || `${tradeDate} 09:30:00`).substring(11, 16);
    const sessionEnd = (regularMarket?.end || `${tradeDate} 16:00:00`).substring(11, 16);
    const clock = proxyService.getDataClock();
    const now = clock.format('HH:mm');
    const watching: IWatchStatus[] = [];
    const newAlerts: IMarketAlert[] = [];

    Object.entries(stocks).forEach(([quote, stock]) => {
        const facts = buildWatchFacts({ quote, tradeDate, ...stock, sessionStart, sessionEnd, dataClock: clock });
        watchSignals
            .filter((signal) => signal.watches(facts))
            .forEach((signal) => {
                const status = signal.status(facts);
                if (status) {
                    watching.push(status);
                }
                signal.detect(facts).forEach((alert) => {
                    if (!alerts.has(alert.id)) {
                        alerts.set(alert.id, alert);
                        newAlerts.push(alert);
                    }
                });
            });
    });

    return {
        state: {
            tradeDate,
            clockIso: clock.toISOString(),
            sessionOpen: clock.format('YYYY-MM-DD') === tradeDate && now >= sessionStart && now < sessionEnd,
            signals: describeSignals(),
            watching: _.sortBy(watching, 'quote'),
            alerts: _.orderBy(Array.from(alerts.values()), ['timeIso', 'quote'], ['desc', 'asc']),
        },
        newAlerts,
    };
};
