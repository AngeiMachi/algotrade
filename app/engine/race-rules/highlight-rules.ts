import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
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

export const highlightRules: IHighlightRule[] = [maReclaimed, trendingVolume];
