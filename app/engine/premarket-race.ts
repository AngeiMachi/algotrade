import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../config/globals.config';
import { logger } from '../config/winston.config';
import * as quoteUtils from '../utils/quote-utils';
import * as clientService from '../proxy/client-service';
import * as AlpacaAPI from '../proxy/alpaca-api';
import * as behaviorManager from './behavior-manager';
import { IQuoteFullIntervalData, IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';

const NEW_YORK = 'America/New_York';
const RECOMPUTE_DEBOUNCE_MS = 300;

export type RaceStatus = 'racing' | 'at-risk' | 'waiting' | 'out';
export type RacePhase = 'waiting' | 'premarket' | 'decision' | 'final';

export interface IRaceEntry {
    quote: string;
    rank: number | null;
    previousRank: number | null;
    status: RaceStatus;
    reason: string;
    price: number | null;
    previousClose: number | null;
    gapPct: number | null;
    sma: number | null;
    smaCushionPct: number | null;
    premarketVolume: number;
    premarketDollarVolume: number;
    smaTouches: number; // premarket hourly candles whose wick crossed the SMA while the close held
    lapsInTopThree: number;
    lastCandle: string | null;
    eliminatedAt: string | null;
}

export interface IRaceSnapshot {
    tradeDate: string;
    isMock: boolean;
    phase: RacePhase;
    direction: 'long' | 'short';
    raceTimeIso: string | null;
    bellIso: string;
    lap: number;
    totalLaps: number;
    decisionLaps: number;
    rules: typeof globalConfig.PremarketRace;
    standings: IRaceEntry[];
    waiting: IRaceEntry[];
    out: IRaceEntry[];
    updatedAt: string;
}

interface IRacer {
    quote: string;
    previousClose: number | null;
    priorHourlyCloses: number[];
    intervals: IQuoteIntervals;
    elimination: { time: string; reason: string } | null;
    lapsInTopThree: number;
    lastTopThreeCandle: string;
}

interface IHourlyCandle {
    hour: string;
    low: number;
    high: number;
    close: number;
    complete: boolean;
}

const racers: { [key: string]: IRacer } = {};
let snapshot: IRaceSnapshot | null = null;
let recomputeTimer: NodeJS.Timeout | null = null;
let currentRaceCandle = '';
let latestRanks: { [key: string]: number } = {};
let ranksAtPreviousCandle: { [key: string]: number } = {};

export const registerQuote = async (quote: string, intervals: IQuoteIntervals, metadata: IQuoteMetadata) => {
    const group = behaviorManager.getQuoteGroup(quote);
    if (group && globalConfig.PremarketRace.excludeGroups.includes(group)) {
        return;
    }

    let priorHourlyCloses: number[];
    try {
        const hourlyHistory = await AlpacaAPI.getQuote24HourHourlyHistory(quote, quoteUtils.getCurrentTradingDate());
        priorHourlyCloses = hourlyHistory.candles.map((candle) => candle.close);
    } catch (err) {
        logger.error(`premarket-race could not load hourly history for ${quote}, leaving it out of the race: ${err}`);
        return;
    }

    racers[quote] = {
        quote,
        previousClose: metadata.previousDay?.close ?? null,
        priorHourlyCloses,
        intervals,
        elimination: null,
        lapsInTopThree: 0,
        lastTopThreeCandle: '',
    };
    scheduleRecompute();
};

export const updateQuote = (quote: string, intervals: IQuoteIntervals) => {
    const racer = racers[quote];
    if (!racer || !intervals) {
        return;
    }
    racer.intervals = intervals;
    scheduleRecompute();
};

export const getSnapshot = (): IRaceSnapshot | null => snapshot;

const scheduleRecompute = () => {
    if (snapshot?.phase === 'final') {
        return;
    }
    if (recomputeTimer) {
        clearTimeout(recomputeTimer);
    }
    recomputeTimer = setTimeout(() => {
        recomputeTimer = null;
        try {
            snapshot = computeSnapshot();
            clientService.emitRaceUpdate(snapshot);
        } catch (err) {
            logger.error('premarket-race recompute failed ' + err);
        }
    }, RECOMPUTE_DEBOUNCE_MS);
};

const computeSnapshot = (): IRaceSnapshot => {
    const settings = globalConfig.PremarketRace;
    const tradeDate = quoteUtils.getCurrentTradingDate();
    const bellKey = quoteUtils.getMarketHours()?.sessionHours?.regularMarket?.start || `${tradeDate} 09:30:00`;
    const premarketStartKey = `${tradeDate} ${settings.premarketStart}:00`;
    const decisionStartKey = `${tradeDate} ${settings.decisionWindowStart}:00`;

    const premarketKeysOf = (racer: IRacer) =>
        Object.keys(racer.intervals)
            .filter((key) => key >= premarketStartKey && key < bellKey)
            .sort();

    const allRacers = Object.values(racers);
    const isFinal = allRacers.some((racer) => Object.keys(racer.intervals).some((key) => key.startsWith(tradeDate) && key >= bellKey));
    const raceCandle = _.max(allRacers.map((racer) => _.last(premarketKeysOf(racer)) || '')) || '';

    if (raceCandle !== currentRaceCandle) {
        ranksAtPreviousCandle = { ...latestRanks };
        currentRaceCandle = raceCandle;
    }

    const raceEnd = isFinal ? toNewYork(bellKey) : raceCandle ? toNewYork(raceCandle).add(5, 'minutes') : null;
    const entries = allRacers.map((racer) => evaluateRacer(racer, premarketKeysOf(racer), bellKey, raceEnd, isFinal));

    const contenders = _.orderBy(
        entries.filter((entry) => entry.status === 'racing' || entry.status === 'at-risk'),
        (entry) => directional(entry.gapPct as number),
        'desc'
    );

    latestRanks = {};
    contenders.forEach((entry, index) => {
        entry.rank = index + 1;
        entry.previousRank = ranksAtPreviousCandle[entry.quote] ?? null;
        latestRanks[entry.quote] = entry.rank;

        const racer = racers[entry.quote];
        if (entry.rank <= 3 && racer.lastTopThreeCandle !== raceCandle) {
            racer.lapsInTopThree++;
            racer.lastTopThreeCandle = raceCandle;
        }
        entry.lapsInTopThree = racer.lapsInTopThree;
    });

    const lapMinutes = 5;
    const totalLaps = Math.round(toNewYork(bellKey).diff(toNewYork(premarketStartKey), 'minutes') / lapMinutes);
    const decisionLaps = Math.round(toNewYork(bellKey).diff(toNewYork(decisionStartKey), 'minutes') / lapMinutes);
    const lap = raceCandle ? Math.round(toNewYork(raceCandle).diff(toNewYork(premarketStartKey), 'minutes') / lapMinutes) + 1 : 0;

    let phase: RacePhase = 'waiting';
    if (isFinal) {
        phase = 'final';
    } else if (raceCandle >= decisionStartKey) {
        phase = 'decision';
    } else if (raceCandle) {
        phase = 'premarket';
    }

    return {
        tradeDate,
        isMock: globalConfig.Mock.IsMock,
        phase,
        direction: settings.direction,
        raceTimeIso: raceCandle ? toNewYork(raceCandle).toISOString() : null,
        bellIso: toNewYork(bellKey).toISOString(),
        lap,
        totalLaps,
        decisionLaps,
        rules: settings,
        standings: contenders,
        waiting: _.orderBy(
            entries.filter((entry) => entry.status === 'waiting'),
            (entry) => (entry.gapPct === null ? -Infinity : directional(entry.gapPct)),
            'desc'
        ),
        out: _.sortBy(
            entries.filter((entry) => entry.status === 'out'),
            (entry) => entry.eliminatedAt
        ),
        updatedAt: new Date().toISOString(),
    };
};

const evaluateRacer = (racer: IRacer, premarketKeys: string[], bellKey: string, raceEnd: moment.Moment | null, isFinal: boolean): IRaceEntry => {
    const settings = globalConfig.PremarketRace;
    const entry: IRaceEntry = {
        quote: racer.quote,
        rank: null,
        previousRank: null,
        status: 'waiting',
        reason: '',
        price: null,
        previousClose: racer.previousClose,
        gapPct: null,
        sma: null,
        smaCushionPct: null,
        premarketVolume: 0,
        premarketDollarVolume: 0,
        smaTouches: 0,
        lapsInTopThree: racer.lapsInTopThree,
        lastCandle: null,
        eliminatedAt: null,
    };

    if (!racer.previousClose) {
        entry.reason = "No previous close";
        return entry;
    }
    if (premarketKeys.length === 0 || !raceEnd) {
        entry.reason = 'No premarket trades yet';
        return entry;
    }

    const bars = premarketKeys.map((key) => racer.intervals[key]);
    const lastBar = _.last(bars) as IQuoteFullIntervalData;

    entry.price = lastBar.close;
    entry.lastCandle = (_.last(premarketKeys) as string).substring(11, 16);
    entry.gapPct = ((lastBar.close - racer.previousClose) / racer.previousClose) * 100;
    entry.premarketVolume = _.sumBy(bars, 'volume');
    entry.premarketDollarVolume = _.sumBy(bars, (bar) => bar.volume * bar.close);

    const hourlyCandles = toHourlyCandles(racer.intervals, premarketKeys, raceEnd, isFinal);
    const closedHourlyCloses = [...racer.priorHourlyCloses];
    let sma = NaN;

    for (const candle of hourlyCandles) {
        sma = _.mean(_.takeRight([...closedHourlyCloses, candle.close], settings.smaPeriod));
        const wickExtreme = settings.direction === 'long' ? candle.low : candle.high;
        if (directional(wickExtreme - sma) < 0) {
            entry.smaTouches++;
        }
        if (candle.complete) {
            closedHourlyCloses.push(candle.close);
            if (!racer.elimination && directional((candle.close - sma) / sma * 100) < -settings.smaTolerancePct) {
                racer.elimination = {
                    time: `${candle.hour}:00`,
                    reason: `Hourly close ${settings.direction === 'long' ? 'below' : 'above'} the ${settings.smaPeriod} SMA`,
                };
            }
        }
    }

    entry.sma = sma;
    entry.smaCushionPct = directional(((lastBar.close - sma) / sma) * 100);

    const openingBar = racer.intervals[bellKey];
    if (!racer.elimination && isFinal && openingBar && directional(openingBar.open - racer.previousClose) <= 0) {
        racer.elimination = {
            time: bellKey.substring(11, 16),
            reason: `Opened ${settings.direction === 'long' ? 'below' : 'above'} yesterday's close`,
        };
    }

    if (racer.elimination) {
        entry.status = 'out';
        entry.reason = racer.elimination.reason;
        entry.eliminatedAt = racer.elimination.time;
    } else if (directional(entry.gapPct) <= 0) {
        entry.reason = `Not ${settings.direction === 'long' ? 'above' : 'below'} yesterday's close`;
    } else if (entry.premarketDollarVolume < settings.minPremarketDollarVolume) {
        entry.reason = 'Thin premarket volume';
    } else if (entry.smaCushionPct < -settings.smaTolerancePct) {
        entry.status = 'at-risk';
        entry.reason = `Trading through the ${settings.smaPeriod} SMA in the ${(_.last(hourlyCandles) as IHourlyCandle).hour}:00 candle`;
    } else {
        entry.status = 'racing';
    }

    return entry;
};

// After the bell the last premarket hour is judged as closed, even though its hourly candle runs past 09:30.
const toHourlyCandles = (intervals: IQuoteIntervals, premarketKeys: string[], raceEnd: moment.Moment, isFinal: boolean): IHourlyCandle[] => {
    const keysByHour = _.groupBy(premarketKeys, (key) => key.substring(11, 13));

    return Object.keys(keysByHour)
        .sort()
        .map((hour) => {
            const lastKey = _.last(keysByHour[hour]) as string;
            const hourEnd = toNewYork(`${lastKey.substring(0, 10)} ${hour}:00:00`).add(1, 'hour');
            return {
                hour,
                low: Math.min(...keysByHour[hour].map((key) => intervals[key].low)),
                high: Math.max(...keysByHour[hour].map((key) => intervals[key].high)),
                close: intervals[lastKey].close,
                complete: isFinal || !hourEnd.isAfter(raceEnd),
            };
        });
};

const directional = (value: number) => (globalConfig.PremarketRace.direction === 'long' ? value : -value);

const toNewYork = (key: string) => moment.tz(key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK);
