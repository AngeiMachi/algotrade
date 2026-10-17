import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { findChartPatterns, PATTERN_NAMES } from './chart-patterns';
import { IHighlightRule } from './race-rule.types';
import { formatPct, raceWords } from './race-words';

// Highlights point out good setups. They do not change the score or the ranking.

const period = () => RaceRulesConfig.reclaim.smaPeriod;

export const maReclaimed: IHighlightRule = {
    id: 'ma-reclaimed',
    title: `Reclaimed the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA`,
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `Yesterday the stock opened ${words.badSide} the hourly ${period()} SMA; today it opens (before the bell: trades) ${words.goodSide} it. Whether it crossed during yesterday's session doesn't matter. Counted only when our two SMA readings agree (see docs).`;
    },
    check: (facts) => {
        if (!facts.reclaimedSma || !facts.yesterdayBelowReclaimSma || facts.reclaimSma === null || facts.reclaimSmaCushionPct === null) {
            return null;
        }
        const words = raceWords(facts.direction);
        const { openedAt, smaAtOpen } = facts.yesterdayBelowReclaimSma;
        return {
            id: 'ma-reclaimed',
            label: 'MA reclaimed',
            message:
                `Yesterday opened at ${openedAt.toFixed(2)}, ${words.badSide} the hourly ${period()} SMA (${smaAtOpen.toFixed(2)}). ` +
                `Today ${facts.isAfterBell ? 'opened' : 'trading'} ${formatPct(facts.reclaimSmaCushionPct)} ${words.goodSide} it (${facts.reclaimSma.toFixed(2)}).`,
        };
    },
};

export const trendingVolume: IHighlightRule = {
    id: 'trending-volume',
    title: 'Trending volume',
    describe: () => {
        const { days, trendingAt, fromTime } = RaceRulesConfig.relativeVolume;
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `Pre-market volume so far is at least ${trendingAt}× the average of the last ${days} sessions up to the same time of morning (from ${fromTime}), on a stock that also passes the gap: ${words.goodSide} yesterday's close and ${words.previousExtreme}.`;
    },
    check: (facts) => {
        const { days, trendingAt, fromTime } = RaceRulesConfig.relativeVolume;
        if (facts.relativeVolume === null || facts.relativeVolume < trendingAt || facts.lastCandle < fromTime) {
            return null;
        }
        const pastPreviousExtremePct = facts.isAfterBell ? facts.openingVsPreviousExtremePct : facts.previousExtremeCushionPct;
        if (facts.gapPct <= 0 || pastPreviousExtremePct === null || pastPreviousExtremePct <= 0) {
            return null;
        }
        return {
            id: 'trending-volume',
            label: 'Trending volume',
            message:
                `${facts.relativeVolume.toFixed(1)}× normal pre-market volume: ${Math.round(facts.premarketVolume).toLocaleString()} shares by ${facts.lastCandle}, ` +
                `vs ${Math.round(facts.averagePremarketVolume as number).toLocaleString()} on an average morning (last ${days} sessions).`,
        };
    },
};

export const aboveBollinger: IHighlightRule = {
    id: 'above-bollinger',
    title: 'Opens outside the daily Bollinger band',
    describe: () => {
        const { periodDays, stdDevs } = RaceRulesConfig.bollinger;
        const band = globalConfig.PremarketRace.direction === 'long' ? 'upper' : 'lower';
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `The price (the open, after the bell) is ${words.goodSide} the daily ${band} Bollinger band (${periodDays} days, ${stdDevs}σ), drawn with today's price as the latest close, as the daily chart shows it at the open.`;
    },
    check: (facts) => {
        if (facts.bollingerBand === null || facts.bollingerCushionPct === null || facts.bollingerCushionPct <= 0) {
            return null;
        }
        const { periodDays, stdDevs } = RaceRulesConfig.bollinger;
        const words = raceWords(facts.direction);
        const band = facts.direction === 'long' ? 'upper' : 'lower';
        return {
            id: 'above-bollinger',
            label: facts.direction === 'long' ? 'Above upper BB' : 'Below lower BB',
            message:
                `${facts.isAfterBell ? 'Opened' : 'Trading'} ${formatPct(facts.bollingerCushionPct)} ${words.goodSide} the daily ${band} Bollinger band ` +
                `(${facts.bollingerBand.toFixed(2)}; ${periodDays} days, ${stdDevs}σ)${facts.isAfterBell ? '' : ': it is set to open outside the band'}.`,
        };
    },
};

export const chartPattern: IHighlightRule = {
    id: 'chart-pattern',
    title: 'Chart pattern breakout',
    describe: () => {
        const { lookbackDays, minTouches, breakoutAtr, nearAtr } = RaceRulesConfig.chartPatterns;
        return (
            `Classic bullish patterns on the last ${lookbackDays} daily candles, drawn from swing highs and lows: a resistance line from a swing high, ` +
            `touched at least ${minTouches} times, that no close crossed until yesterday (a breakout counts on its first day and the day after, then not again for ${RaceRulesConfig.chartPatterns.quietDays} sessions), named by its shape and the support under it ` +
            `(falling trendline, falling wedge, descending, symmetrical or ascending triangle, range, resistance), plus bull flags and double bottoms. ` +
            `"Breakout" when the price (the open, after the bell) is at least ${breakoutAtr} ATR above the line, the flag top or the neckline; ` +
            `"Near breakout" up to ${nearAtr} ATR under it. Detection only, not back-tested; it does not change the score.`
        );
    },
    check: (facts) => {
        if (facts.direction !== 'long') {
            return null;
        }
        const [best, ...others] = findChartPatterns(facts.priorDailyCandles, facts.price, facts.atrPct);
        if (!best) {
            return null;
        }
        const name = PATTERN_NAMES[best.kind];
        const where = best.distanceAtr >= 0 ? `${best.distanceAtr.toFixed(2)} ATR above` : `${(-best.distanceAtr).toFixed(2)} ATR under`;
        return {
            id: best.state === 'breakout' ? 'pattern-breakout' : 'pattern-near',
            label: best.state === 'breakout' ? `${name} breakout${best.day === 2 ? ' (day 2)' : ''}` : `Near: ${name.toLowerCase()}`,
            message:
                (best.day === 2 ? 'Second day of the breakout. ' : '') +
                `${name}, ${best.days} days. ${best.description}. ${facts.isAfterBell ? 'Opened' : 'Trading'} ${where} it.` +
                (others.length > 0 ? ` Also: ${others.map((pattern) => `${PATTERN_NAMES[pattern.kind].toLowerCase()} (${pattern.state})`).join(', ')}.` : ''),
        };
    },
};

export const highlightRules: IHighlightRule[] = [maReclaimed, trendingVolume, aboveBollinger, chartPattern];
