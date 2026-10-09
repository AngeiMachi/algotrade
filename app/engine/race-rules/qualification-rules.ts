import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IQualificationRule } from './race-rule.types';
import { raceWords } from './race-words';

// Qualification rules are temporary: a stock that fails one waits on the side and can rejoin on a later candle.

export const tradingPastPreviousClose: IQualificationRule = {
    id: 'trading-past-previous-close',
    title: "Trading past yesterday's close",
    describe: () => `Only stocks trading ${raceWords(globalConfig.PremarketRace.direction).goodSide} yesterday's close are in the race.`,
    check: (facts) => (facts.gapPct > 0 ? null : `Not ${raceWords(facts.direction).goodSide} yesterday's close`),
};

export const enoughPremarketVolume: IQualificationRule = {
    id: 'enough-premarket-volume',
    title: 'Enough pre-market volume',
    describe: () => `At least $${(RaceRulesConfig.minPremarketDollarVolume / 1000).toFixed(0)}K must trade pre-market, to cut false signals from thin trading.`,
    check: (facts) => (facts.premarketDollarVolume >= RaceRulesConfig.minPremarketDollarVolume ? null : 'Thin premarket volume'),
};

export const qualificationRules: IQualificationRule[] = [tradingPastPreviousClose, enoughPremarketVolume];
