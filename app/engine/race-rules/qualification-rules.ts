import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IQualificationRule } from './race-rule.types';
import { raceWords } from './race-words';

// Qualification rules are temporary: a stock that fails one sits on the side and can rejoin on a later candle.
// They run in list order and the first failure decides where the stock is listed.

export const tradingPastPreviousExtreme: IQualificationRule = {
    id: 'trading-past-previous-extreme',
    title: "Trading past yesterday's high",
    listedAs: 'out',
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `Before the bell, a stock ${words.badSide} ${words.previousExtreme} is listed as out. It comes back if it trades ${words.goodSide} it, and at the bell it must open ${words.goodSide} it to stay. Exception: a stock reclaiming the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA stays in, marked "Below high".`;
    },
    check: (facts) => {
        // After the bell the opening price decides, in elimination-rules (openedInsidePreviousRange).
        if (
            facts.isAfterBell ||
            facts.previousExtreme === null ||
            facts.previousExtremeCushionPct === null ||
            facts.previousExtremeCushionPct > 0 ||
            facts.reclaimedSma
        ) {
            return null;
        }
        const words = raceWords(facts.direction);
        return `${words.badSide[0].toUpperCase()}${words.badSide.slice(1)} ${words.previousExtreme} (${facts.previousExtreme.toFixed(2)})`;
    },
};

export const tradingPastPreviousClose: IQualificationRule = {
    id: 'trading-past-previous-close',
    title: "Trading past yesterday's close",
    listedAs: 'waiting',
    describe: () => `Only stocks trading ${raceWords(globalConfig.PremarketRace.direction).goodSide} yesterday's close are in the race.`,
    check: (facts) => (facts.gapPct > 0 ? null : `Not ${raceWords(facts.direction).goodSide} yesterday's close`),
};

export const enoughPremarketVolume: IQualificationRule = {
    id: 'enough-premarket-volume',
    title: 'Enough pre-market volume',
    listedAs: 'waiting',
    describe: () => `At least $${(RaceRulesConfig.minPremarketDollarVolume / 1000).toFixed(0)}K must trade pre-market, to cut false signals from thin trading.`,
    check: (facts) => (facts.premarketDollarVolume >= RaceRulesConfig.minPremarketDollarVolume ? null : 'Thin premarket volume'),
};

export const qualificationRules: IQualificationRule[] = [tradingPastPreviousExtreme, tradingPastPreviousClose, enoughPremarketVolume];
