import * as _ from 'lodash';
import moment from 'moment-timezone';

import { MarketWatchConfig } from '../../config/market-watch.config';
import { logger } from '../../config/winston.config';
import * as quoteUtils from '../../utils/quote-utils';
import * as AlpacaAPI from '../../proxy/alpaca-api';
import * as clientService from '../../proxy/client-service';
import * as proxyService from '../../proxy/proxy-service';
import { IQuoteIntervals } from '../../models/quote-data.model';
import { IDailySmas } from '../race-rules/race-facts';
import { IPremarketVolumeDay, IRaceFacts } from '../race-rules/race-rule.types';
import { volumeBadge } from './alert-badges';
import { IAlertBadge, IMarketAlert, IWatchSignal, IWatchStatus } from './market-watch.types';
import * as globalConfig from '../../config/globals.config';
import { setShine, shineSwitch } from './shine-switch';
import { watchSignals } from './signals';
import { buildWatchFacts } from './watch-facts';

// Follows the race's stocks through the regular session, runs every signal on each update and keeps the day's
// alerts: the notification center. New alerts are pushed to the board as `marketAlert`; the whole state as
// `marketWatchUpdate`.

const RECOMPUTE_INTERVAL_MS = 300;

export interface IWatchedStock {
    atrPct: number;
    priorDailyCloses: number[]; // daily closes before today, oldest first
    dailySmas: IDailySmas | null;
    priorHourlyCloses: number[]; // 24-hour hourly closes before today's pre-market, oldest first
    volumeHistory: IPremarketVolumeDay[]; // recent sessions' 5-minute volume, 04:00 to the close
    intervals: IQuoteIntervals;
    prior5MinCloses?: AlpacaAPI.IPrior5MinuteCloses | null; // loaded once the Shine alert is switched on
    shineOnly?: boolean; // out of the race (too thin, no hourly history): only the Shine alert, which watches every stock
}

export interface IShineState {
    on: boolean;
    since: string | null; // ISO, when it was switched on
    loading: number; // stocks whose 5-minute history is still loading
}

export interface IMarketWatchState {
    tradeDate: string;
    clockIso: string;
    sessionOpen: boolean;
    shine: IShineState;
    signals: { id: string; title: string; shortTitle: string; description: string; switchable: boolean }[];
    watching: IWatchStatus[];
    alerts: IMarketAlert[]; // newest first
    volume: { [quote: string]: IAlertBadge }; // live volume badge of each stock with alerts
}

// Sent with each new alert. Live = recent enough on the data clock to pop up; older ones (rebuilt after a restart)
// only join the notification center.
export interface IMarketAlertEvent {
    alert: IMarketAlert;
    live: boolean;
}

const stocks: { [quote: string]: IWatchedStock } = {};
let board = new Map<string, IRaceFacts>();
const alerts = new Map<string, IMarketAlert>();
let state: IMarketWatchState | null = null;
let recomputeTimer: NodeJS.Timeout | null = null;

const historyLoading = new Set<string>();

// On when the trader switched it on today; in a replay also on its own (no time to press it) unless he switched it off.
const shineOnSince = (tradeDate: string): string | null => {
    const choice = shineSwitch(tradeDate);
    if (choice) {
        return choice.on ? choice.since : null;
    }
    return globalConfig.Mock.IsMock && MarketWatchConfig.shine.autoOnInSimulation ? `${tradeDate}T00:00:00` : null;
};

export const track = (quote: string, stock: IWatchedStock) => {
    stocks[quote] = { ...stock, prior5MinCloses: stocks[quote]?.prior5MinCloses };
    if (shineOnSince(quoteUtils.getCurrentTradingDate())) {
        loadShineHistory([quote]);
    }
    scheduleRecompute();
};

// The trader's Shine switch on the header. On: every followed stock gets its 5-minute history (one batched load).
// Off: its alerts leave the board; switched on again, they are rebuilt.
export const switchShine = (on: boolean) => {
    const tradeDate = quoteUtils.getCurrentTradingDate();
    setShine(tradeDate, on, proxyService.getDataClock().toISOString());
    logger.info(`market-watch shine switched ${on ? 'on' : 'off'} for ${tradeDate}`);
    if (on) {
        loadShineHistory(Object.keys(stocks));
    } else {
        const switchable = new Set(watchSignals.filter((signal) => signal.switchable).map((signal) => signal.id));
        Array.from(alerts.values())
            .filter((alert) => switchable.has(alert.signal))
            .forEach((alert) => alerts.delete(alert.id));
    }
    scheduleRecompute();
};

const historyRequests: { [quote: string]: Promise<AlpacaAPI.IPrior5MinuteCloses> } = {};
const requestShineHistory = (quote: string): Promise<AlpacaAPI.IPrior5MinuteCloses> => {
    const { priorCloses, priorCalendarDays } = MarketWatchConfig.shine;
    if (!historyRequests[quote]) {
        historyRequests[quote] = AlpacaAPI.getPrior5MinuteCloses(quote, quoteUtils.getCurrentTradingDate(), priorCloses, priorCalendarDays).catch((err) => {
            delete historyRequests[quote];
            throw err;
        });
    }
    return historyRequests[quote];
};

// At startup, with the race's history: requesting every symbol at once lets the Alpaca client merge them into a few
// multi-symbol calls (one by one as each stock registers, they would queue behind the rate limit for minutes).
export const preloadShineHistory = async (quotes: string[]) => {
    if (shineOnSince(quoteUtils.getCurrentTradingDate())) {
        await Promise.all(quotes.map((quote) => requestShineHistory(quote).catch(() => undefined)));
    }
};

// Requested together so the Alpaca client merges them into a few multi-symbol calls.
const loadShineHistory = (quotes: string[]) => {
    quotes
        .filter((quote) => stocks[quote] && !stocks[quote].prior5MinCloses && !historyLoading.has(quote))
        .forEach(async (quote) => {
            historyLoading.add(quote);
            try {
                stocks[quote].prior5MinCloses = await requestShineHistory(quote);
            } catch (err) {
                logger.error(`market-watch could not load 5-minute history for ${quote}: ${err}`);
            } finally {
                historyLoading.delete(quote);
                scheduleRecompute();
            }
        });
};

export const updateQuote = (quote: string, intervals: IQuoteIntervals) => {
    if (!stocks[quote] || !intervals) {
        return;
    }
    stocks[quote].intervals = intervals;
    scheduleRecompute();
};

// The race's standings (after the bell: the final board) with the facts each was judged on. Some signals only
// watch stocks on it.
export const setBoard = (standings: { quote: string; facts: IRaceFacts }[]) => {
    const signature = (facts: IRaceFacts) => `${facts.isAfterBell}:${facts.price}`;
    const unchanged =
        standings.length === board.size && standings.every(({ quote, facts }) => board.has(quote) && signature(board.get(quote)!) === signature(facts));
    board = new Map(standings.map(({ quote, facts }) => [quote, facts]));
    if (!unchanged) {
        scheduleRecompute();
    }
};

export const getState = (): IMarketWatchState => state ?? computeState().state;

// Stocks some signal is waiting on right now: their forming candle is worth refreshing.
export const getArmedQuotes = (): string[] => (state?.watching || []).filter((status) => status.state === 'Armed').map((status) => status.quote);

export const describeSignals = () =>
    watchSignals.map((signal) => ({
        id: signal.id,
        title: signal.title,
        shortTitle: signal.shortTitle,
        description: signal.describe(),
        switchable: !!signal.switchable,
    }));

// The board's group order: a switched-on signal first (hidden while off), then a signal with a lead time until that
// long after the bell (then it goes last).
const orderedSignals = (clock: moment.Moment, tradeDate: string, sessionStart: string, shineOn: boolean) => {
    const bell = moment.tz(`${tradeDate} ${sessionStart}`, 'YYYY-MM-DD HH:mm', 'America/New_York');
    const rank = (signal: IWatchSignal) => {
        if (signal.switchable) {
            return 0;
        }
        if (!signal.leadsForMinutes) {
            return 2;
        }
        return clock.isBefore(bell.clone().add(signal.leadsForMinutes(), 'minutes')) ? 1 : 3;
    };
    const order = new Map(watchSignals.map((signal) => [signal.id, rank(signal)]));
    return _.sortBy(
        describeSignals().filter((signal) => shineOn || !signal.switchable),
        (signal) => order.get(signal.id)
    );
};

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
    const volume: { [quote: string]: IAlertBadge } = {};
    const alertedQuotes = new Set(Array.from(alerts.values()).map((alert) => alert.quote));
    const shineSince = shineOnSince(tradeDate);

    Object.entries(stocks).forEach(([quote, stock]) => {
        const facts = buildWatchFacts({
            quote,
            tradeDate,
            ...stock,
            sessionStart,
            sessionEnd,
            dataClock: clock,
            onBoard: board.has(quote),
            race: board.get(quote) ?? null,
            shineOn: !!shineSince,
        });
        watchSignals
            .filter((signal) => (!stock.shineOnly || signal.switchable) && signal.watches(facts))
            .forEach((signal) => {
                const status = signal.status(facts);
                if (status) {
                    watching.push(status);
                }
                signal.detect(facts).forEach((alert) => {
                    if (!alerts.has(alert.id)) {
                        alerts.set(alert.id, alert);
                        newAlerts.push(alert);
                        alertedQuotes.add(quote);
                    }
                });
            });
        const badge = alertedQuotes.has(quote) ? volumeBadge(facts) : null;
        if (badge) {
            volume[quote] = badge;
        }
    });

    return {
        state: {
            tradeDate,
            clockIso: clock.toISOString(),
            sessionOpen: clock.format('YYYY-MM-DD') === tradeDate && now >= sessionStart && now < sessionEnd,
            shine: { on: !!shineSince, since: shineSince, loading: historyLoading.size },
            signals: orderedSignals(clock, tradeDate, sessionStart, !!shineSince),
            watching: _.sortBy(watching, 'quote'),
            alerts: _.orderBy(Array.from(alerts.values()), ['timeIso', 'quote'], ['desc', 'asc']),
            volume,
        },
        newAlerts,
    };
};
