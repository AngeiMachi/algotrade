import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IKeepRule } from './race-rule.types';
import { formatPct, raceWords } from './race-words';

// Keep rules override elimination and qualification: a stock matching one stays on the board, scored like the rest.
// Its warnings and score still show how healthy it is; it just can't be taken off the list.

export const opensOutsideBollinger: IKeepRule = {
    id: 'kept-outside-bollinger',
    title: 'Opens outside the daily Bollinger band',
    label: 'Kept: BB',
    describe: () => {
        const band = globalConfig.PremarketRace.direction === 'long' ? 'upper' : 'lower';
        const { periodDays, stdDevs } = RaceRulesConfig.bollinger;
        return `A stock ${raceWords(globalConfig.PremarketRace.direction).goodSide} the daily ${band} Bollinger band (${periodDays} days, ${stdDevs}σ) stays on the board even when it fails the hourly 20 SMA, yesterday's range or the volume rules. Before the bell it is judged on its latest price, after the bell on the open. The market watch follows these stocks through the session.`;
    },
    check: (facts) => {
        if (facts.isAfterBell && facts.openingPrice === null) {
            return null;
        }
        if (facts.bollingerBand === null || facts.bollingerCushionPct === null || facts.bollingerCushionPct <= 0) {
            return null;
        }
        const band = facts.direction === 'long' ? 'upper' : 'lower';
        return `${facts.isAfterBell ? 'Opened' : 'Trading'} ${formatPct(facts.bollingerCushionPct)} ${raceWords(facts.direction).goodSide} the daily ${band} Bollinger band (${facts.bollingerBand.toFixed(2)})`;
    },
};

export const keepRules: IKeepRule[] = [opensOutsideBollinger];
