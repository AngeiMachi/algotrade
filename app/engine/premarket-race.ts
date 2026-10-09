import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../config/globals.config';
import { RaceRulesConfig } from '../config/race-rules.config';
import { logger } from '../config/winston.config';
import * as quoteUtils from '../utils/quote-utils';
import * as clientService from '../proxy/client-service';
import * as AlpacaAPI from '../proxy/alpaca-api';
import * as proxyService from '../proxy/proxy-service';
import * as behaviorManager from './behavior-manager';
import * as watchlist from './watchlist';
import { IQuoteIntervals, IQuoteMetadata } from '../models/quote-data.model';
import {
    averageTrueRangePct,
    buildRaceFacts,
    dailySmas,
    dailyTrend,
    highlightRules,
    IDailySmas,
    IDailyTrend,
    IPremarketVolumeDay,
    IPriorHourlyCandle,
    IRaceHighlight,
    IYesterdayBelowSma,
    yesterdayOpenedBelowSma,
    describeRuleBook,
    eliminationRules,
    IElimination,
    IRaceWarning,
    IRuleDescription,
    IScoreFactor,
    qualificationRules,
    scoreRacer,
    tradingThroughSma,
    warningRules,
} from './race-rules';

const NEW_YORK = 'America/New_York';
const RECOMPUTE_INTERVAL_MS = 300;

export type RaceStatus = 'racing' | 'at-risk' | 'waiting' | 'out' | 'not-in-race' | 'loading' | 'no-data';
export type RacePhase = 'waiting' | 'premarket' | 'decision' | 'final';

export interface IRaceEntry {
    quote: string;
    rank: number | null;
    previousRank: number | null;
    status: RaceStatus;
    reason: string;
    score: number | null;
    scoreBreakdown: IScoreFactor[];
    warnings: IRaceWarning[];
    highlights: IRaceHighlight[];
    price: number | null;
    previousClose: number | null;
    gapPct: number | null;
    gapInAtr: number | null;
    sma: number | null;
    smaCushionPct: number | null;
    smaStretchAtr: number | null;
    premarketVolume: number;
    premarketDollarVolume: number;
    relativeVolume: number | null;
    smaTouches: number;
    dailyTrend: IDailyTrend | null;
    lapsInTopThree: number;
    lastCandle: string | null;
    eliminatedAt: string | null;
}

export interface IRaceSnapshot {
    tradeDate: string;
    isMock: boolean;
    phase: RacePhase;
    direction: 'long' | 'short';
    raceTimeIso: string | null; // start of the latest candle in the race
    clockIso: string | null; // the time the data reflects
    candleForming: boolean; // the latest candle has not closed yet (decision window only)
    bellIso: string;
    lap: number;
    totalLaps: number;
    decisionLaps: number;
    rules: typeof globalConfig.PremarketRace;
    ruleBook: IRuleDescription[];
    standings: IRaceEntry[];
    waiting: IRaceEntry[];
    out: IRaceEntry[];
    watched: IRaceEntry[]; // the user's watchlist, in the order it was added, whatever the rules say
    updatedAt: string;
}

interface IRacer {
    quote: string;
    previousClose: number | null;
    previousHigh: number | null;
    previousLow: number | null;
    atrPct: number;
    dailySmas: IDailySmas | null;
    priorDailyCloses: number[];
    priorHourlyCloses: number[];
    priorTradedHourlyCloses: number[];
    yesterdayBelowReclaimSma: IYesterdayBelowSma | null;
    premarketVolumeHistory: IPremarketVolumeDay[];
    intervals: IQuoteIntervals;
    elimination: IElimination | null;
    lapsInTopThree: number;
    lastTopThreeCandle: string;
}

interface IWatchOnly {
    quote: string;
    previousClose: number | null;
    intervals: IQuoteIntervals;
    reason: string;
}

const racers: { [key: string]: IRacer } = {};
const watchOnly: { [key: string]: IWatchOnly } = {};
const watchNoData = new Set<string>();
const hourlyHistoryRequests: { [key: string]: Promise<IPriorHourlyCandle[]> } = {};
const premarketVolumeRequests: { [key: string]: Promise<IPremarketVolumeDay[]> } = {};
let snapshot: IRaceSnapshot | null = null;
// After the bell, true while some stock's opening candle hasn't arrived (delayed data), so the final standings
// keep updating until every open is known.
let awaitingOpens = false;
let recomputeTimer: NodeJS.Timeout | null = null;
let currentRaceCandle = '';
let latestRanks: { [key: string]: number } = {};
let ranksAtPreviousCandle: { [key: string]: number } = {};

export const registerQuote = async (quote: string, intervals: IQuoteIntervals, metadata: IQuoteMetadata) => {
    watchNoData.delete(quote);
    await addRacer(quote, intervals, metadata);
};

// A stock left out of the race stays visible when it is watched, with the reason it isn't racing.
const leaveOutOfRace = (quote: string, intervals: IQuoteIntervals, metadata: IQuoteMetadata, reason: string) => {
    if (watchlist.isWatched(quote)) {
        watchOnly[quote] = { quote, previousClose: metadata.previousDay?.close ?? null, intervals, reason };
    }
};

const addRacer = async (quote: string, intervals: IQuoteIntervals, metadata: IQuoteMetadata) => {
    const group = behaviorManager.getQuoteGroup(quote);
    if (group && globalConfig.PremarketRace.excludeGroups.includes(group)) {
        leaveOutOfRace(quote, intervals, metadata, `Its group (${group}) is not part of the race`);
        return;
    }

    const averageDailyVolume = _.meanBy(_.takeRight(metadata.fullYearDailyHistory || [], RaceRulesConfig.averageVolumeDays), 'volume') || 0;
    if (averageDailyVolume < RaceRulesConfig.minAverageDailyVolume) {
        logger.info(`premarket-race dropping ${quote}: averages ${Math.round(averageDailyVolume).toLocaleString()} shares a day`);
        leaveOutOfRace(quote, intervals, metadata, `Too thin for the race: averages ${Math.round(averageDailyVolume).toLocaleString()} shares a day`);
        return;
    }

    let priorHourlyCandles: IPriorHourlyCandle[];
    try {
        priorHourlyCandles = await loadPriorHourlyCandles(quote);
    } catch (err) {
        logger.error(`premarket-race could not load hourly history for ${quote}, leaving it out of the race: ${err}`);
        leaveOutOfRace(quote, intervals, metadata, 'Hourly history could not be loaded');
        return;
    }
    const premarketVolumeHistory = await loadPremarketVolumeHistory(quote).catch((err) => {
        logger.error(`premarket-race could not load pre-market volume history for ${quote}, racing without RVOL: ${err}`);
        return [] as IPremarketVolumeDay[];
    });

    racers[quote] = {
        quote,
        previousClose: metadata.previousDay?.close ?? null,
        previousHigh: metadata.previousDay?.high ?? null,
        previousLow: metadata.previousDay?.low ?? null,
        atrPct: averageTrueRangePct(metadata.fullYearDailyHistory || [], RaceRulesConfig.atrPeriodDays),
        dailySmas: dailySmas(metadata.fullYearDailyHistory || [], RaceRulesConfig.trend.fastSmaDays, RaceRulesConfig.trend.slowSmaDays),
        priorDailyCloses: _.takeRight(
            (metadata.fullYearDailyHistory || []).filter(
                (candle) => moment(candle.datetime).tz(NEW_YORK).format('YYYY-MM-DD') < quoteUtils.getCurrentTradingDate()
            ),
            RaceRulesConfig.bollinger.periodDays
        ).map((candle) => candle.close),
        priorHourlyCloses: priorHourlyCandles.map((candle) => candle.close),
        priorTradedHourlyCloses: priorHourlyCandles.filter((candle) => candle.traded).map((candle) => candle.close),
        yesterdayBelowReclaimSma: yesterdayOpenedBelowSma(
            priorHourlyCandles,
            metadata.previousDay?.timeNewYork
                ? moment(metadata.previousDay.timeNewYork).format('YYYY-MM-DD')
                : (quoteUtils.getPreviousTradingDate(quoteUtils.getCurrentTradingDate()) as string),
            metadata.previousDay?.open ?? null,
            RaceRulesConfig.reclaim.smaPeriod,
            globalConfig.PremarketRace.direction
        ),
        premarketVolumeHistory,
        intervals,
        elimination: null,
        lapsInTopThree: 0,
        lastTopThreeCandle: '',
    };
    delete watchOnly[quote];
    scheduleRecompute(true);
};

// The engine tried and failed to load this stock (unknown symbol, no trades, broker error).
export const markNoData = (quote: string) => {
    watchNoData.add(quote);
    if (watchlist.isWatched(quote)) {
        scheduleRecompute(true);
    }
};

// The watchlist changed: rebuild the snapshot even when the final standings are frozen.
export const refreshWatched = () => scheduleRecompute(true);

// Requesting every symbol at once lets the Alpaca client merge them into a few multi-symbol calls.
export const preloadRaceHistory = async (quotes: string[]) => {
    await Promise.all<unknown>([
        ...quotes.map((quote) => loadPriorHourlyCandles(quote).catch(() => undefined)),
        ...quotes.map((quote) => loadPremarketVolumeHistory(quote).catch(() => undefined)),
    ]);
};

const loadPremarketVolumeHistory = (quote: string): Promise<IPremarketVolumeDay[]> => {
    if (!premarketVolumeRequests[quote]) {
        premarketVolumeRequests[quote] = AlpacaAPI.getPremarketVolumeHistory(
            quote,
            quoteUtils.getCurrentTradingDate(),
            RaceRulesConfig.relativeVolume.days
        ).catch((err) => {
            delete premarketVolumeRequests[quote];
            throw err;
        });
    }
    return premarketVolumeRequests[quote];
};

const loadPriorHourlyCandles = (quote: string): Promise<IPriorHourlyCandle[]> => {
    if (!hourlyHistoryRequests[quote]) {
        hourlyHistoryRequests[quote] = AlpacaAPI.getQuote24HourHourlyHistory(quote, quoteUtils.getCurrentTradingDate())
            .then((history) =>
                history.candles.map((candle) => ({
                    key: moment(candle.datetime).tz(NEW_YORK).format('YYYY-MM-DD HH:mm:ss'),
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    traded: candle.volume > 0,
                }))
            )
            .catch((err) => {
                delete hourlyHistoryRequests[quote];
                throw err;
            });
    }
    return hourlyHistoryRequests[quote];
};

export const updateQuote = (quote: string, intervals: IQuoteIntervals) => {
    const tracked = racers[quote] || watchOnly[quote];
    if (!tracked || !intervals) {
        return;
    }
    tracked.intervals = intervals;
    scheduleRecompute();
};

export const getSnapshot = (): IRaceSnapshot | null => snapshot;

// The final standings freeze once every open is known, except that a newly registered stock (engine started
// after the bell) must still be added.
const scheduleRecompute = (newRacer: boolean = false) => {
    if (snapshot?.phase === 'final' && !awaitingOpens && !newRacer) {
        return;
    }
    // Throttle rather than debounce: with fast mock laps, updates never pause long enough for a debounce to fire.
    if (recomputeTimer) {
        return;
    }
    recomputeTimer = setTimeout(() => {
        recomputeTimer = null;
        try {
            snapshot = computeSnapshot();
            clientService.emitRaceUpdate(snapshot);
        } catch (err) {
            logger.error('premarket-race recompute failed ' + err);
        }
    }, RECOMPUTE_INTERVAL_MS);
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
    const isAfterBell = allRacers.some((racer) => Object.keys(racer.intervals).some((key) => key.startsWith(tradeDate) && key >= bellKey));
    awaitingOpens = isAfterBell && allRacers.some((racer) => premarketKeysOf(racer).length > 0 && !racer.intervals[bellKey]);
    const raceCandle = _.max(allRacers.map((racer) => _.last(premarketKeysOf(racer)) || '')) || '';

    if (raceCandle !== currentRaceCandle) {
        ranksAtPreviousCandle = { ...latestRanks };
        currentRaceCandle = raceCandle;
    }

    const raceEnd = isAfterBell ? toNewYork(bellKey) : raceCandle ? toNewYork(raceCandle).add(5, 'minutes') : null;
    const dataClock = proxyService.getDataClock();
    const candleForming = !isAfterBell && !!raceEnd && raceEnd.isAfter(dataClock);
    const clock = candleForming ? dataClock : raceEnd;
    const entries = allRacers.map((racer) => evaluateRacer(racer, premarketKeysOf(racer), bellKey, raceEnd, isAfterBell));

    const contenders = _.orderBy(
        entries.filter((entry) => entry.status === 'racing' || entry.status === 'at-risk'),
        [(entry) => entry.score, (entry) => entry.gapPct],
        ['desc', 'desc']
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
    if (isAfterBell) {
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
        clockIso: clock ? clock.toISOString() : null,
        candleForming,
        bellIso: toNewYork(bellKey).toISOString(),
        lap,
        totalLaps,
        decisionLaps,
        rules: settings,
        ruleBook: describeRuleBook(),
        standings: contenders,
        waiting: _.orderBy(
            entries.filter((entry) => entry.status === 'waiting'),
            (entry) => entry.gapPct ?? -Infinity,
            'desc'
        ),
        // Eliminated for good first (by time), then those out only until they trade back past yesterday's high.
        out: _.orderBy(
            entries.filter((entry) => entry.status === 'out'),
            [(entry) => entry.eliminatedAt === null, (entry) => entry.eliminatedAt],
            ['asc', 'asc']
        ),
        watched: watchedEntries(_.keyBy(entries, 'quote'), tradeDate),
        updatedAt: new Date().toISOString(),
    };
};

const watchedEntries = (entriesByQuote: { [quote: string]: IRaceEntry }, tradeDate: string): IRaceEntry[] =>
    watchlist.getWatchedQuotes().map((quote) => {
        if (entriesByQuote[quote]) {
            return entriesByQuote[quote];
        }
        if (watchOnly[quote]) {
            return watchOnlyEntry(watchOnly[quote], tradeDate);
        }
        const entry = emptyEntry({ quote, previousClose: null, dailySmas: null, lapsInTopThree: 0 });
        entry.status = watchNoData.has(quote) ? 'no-data' : 'loading';
        entry.reason = watchNoData.has(quote) ? 'No data for this symbol today' : 'Loading its data';
        return entry;
    });

// Stocks the race never took in: only the latest price and the gap from yesterday's close.
const watchOnlyEntry = (tracked: IWatchOnly, tradeDate: string): IRaceEntry => {
    const entry = emptyEntry({ quote: tracked.quote, previousClose: tracked.previousClose, dailySmas: null, lapsInTopThree: 0 });
    const lastKey = _.max(Object.keys(tracked.intervals).filter((key) => key.startsWith(tradeDate)));
    const price = lastKey ? tracked.intervals[lastKey].close : null;
    Object.assign(entry, {
        status: 'not-in-race',
        reason: tracked.reason,
        price,
        gapPct: price !== null && tracked.previousClose ? ((price - tracked.previousClose) / tracked.previousClose) * 100 : null,
        lastCandle: lastKey ? lastKey.substring(11, 16) : null,
    });
    return entry;
};

// Rules run in a fixed order: eliminated → not qualifying → scored. Warnings ride along with the score.
const evaluateRacer = (racer: IRacer, premarketKeys: string[], bellKey: string, raceEnd: moment.Moment | null, isAfterBell: boolean): IRaceEntry => {
    const entry = emptyEntry(racer);

    if (!racer.previousClose) {
        entry.reason = 'No previous close';
        return entry;
    }
    if (premarketKeys.length === 0 || !raceEnd) {
        entry.reason = 'No premarket trades yet';
        return entry;
    }

    const facts = buildRaceFacts({
        quote: racer.quote,
        direction: globalConfig.PremarketRace.direction,
        smaPeriod: globalConfig.PremarketRace.smaPeriod,
        previousClose: racer.previousClose,
        previousHigh: racer.previousHigh,
        previousLow: racer.previousLow,
        atrPct: racer.atrPct,
        priorHourlyCloses: racer.priorHourlyCloses,
        priorTradedHourlyCloses: racer.priorTradedHourlyCloses,
        reclaimSmaPeriod: RaceRulesConfig.reclaim.smaPeriod,
        yesterdayBelowReclaimSma: racer.yesterdayBelowReclaimSma,
        premarketVolumeHistory: racer.premarketVolumeHistory,
        priorDailyCloses: racer.priorDailyCloses,
        intervals: racer.intervals,
        premarketKeys,
        bellKey,
        raceEnd,
        isAfterBell,
    });

    Object.assign(entry, {
        price: facts.price,
        gapPct: facts.gapPct,
        gapInAtr: facts.gapInAtr,
        sma: facts.sma,
        smaCushionPct: facts.smaCushionPct,
        smaStretchAtr: facts.smaStretchAtr,
        premarketVolume: facts.premarketVolume,
        premarketDollarVolume: facts.premarketDollarVolume,
        relativeVolume: facts.relativeVolume,
        smaTouches: facts.smaTouches,
        dailyTrend: dailyTrend(racer.dailySmas, facts.openingPrice ?? facts.price),
        lastCandle: facts.lastCandle,
    });

    racer.elimination = racer.elimination ?? firstResult(eliminationRules.map((rule) => () => rule.check(facts)));
    if (racer.elimination) {
        entry.status = 'out';
        entry.reason = racer.elimination.reason;
        entry.eliminatedAt = racer.elimination.time;
        return entry;
    }

    const failedQualification = firstResult(
        qualificationRules.map((rule) => () => {
            const reason = rule.check(facts);
            return reason ? { reason, listedAs: rule.listedAs } : null;
        })
    );
    if (failedQualification) {
        entry.reason = failedQualification.reason;
        entry.status = failedQualification.listedAs;
        return entry;
    }

    const { score, breakdown } = scoreRacer(facts);
    entry.score = score;
    entry.scoreBreakdown = breakdown;
    entry.warnings = warningRules.map((rule) => rule.check(facts)).filter((warning): warning is IRaceWarning => warning !== null);
    entry.highlights = highlightRules.map((rule) => rule.check(facts)).filter((highlight): highlight is IRaceHighlight => highlight !== null);
    entry.status = entry.warnings.some((warning) => warning.id === tradingThroughSma.id) ? 'at-risk' : 'racing';
    entry.reason = entry.warnings.map((warning) => warning.message).join(' · ');
    return entry;
};

const emptyEntry = (racer: Pick<IRacer, 'quote' | 'previousClose' | 'dailySmas' | 'lapsInTopThree'>): IRaceEntry => ({
    quote: racer.quote,
    rank: null,
    previousRank: null,
    status: 'waiting',
    reason: '',
    score: null,
    scoreBreakdown: [],
    warnings: [],
    highlights: [],
    price: null,
    previousClose: racer.previousClose,
    gapPct: null,
    gapInAtr: null,
    sma: null,
    smaCushionPct: null,
    smaStretchAtr: null,
    premarketVolume: 0,
    premarketDollarVolume: 0,
    relativeVolume: null,
    smaTouches: 0,
    dailyTrend: dailyTrend(racer.dailySmas, null),
    lapsInTopThree: racer.lapsInTopThree,
    lastCandle: null,
    eliminatedAt: null,
});

const firstResult = <T>(checks: (() => T | null)[]): T | null => {
    for (const check of checks) {
        const result = check();
        if (result) {
            return result;
        }
    }
    return null;
};

const toNewYork = (key: string) => moment.tz(key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK);
