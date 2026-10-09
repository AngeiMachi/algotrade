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
        return `Yesterday the stock opened ${words.badSide} the hourly ${period()} SMA and climbed back to it during the session; today it trades (after the bell: opened) ${words.goodSide} it.`;
    },
    check: (facts) => {
        if (!facts.reclaimedYesterday || facts.reclaimSma === null || facts.reclaimSmaCushionPct === null || facts.reclaimSmaCushionPct <= 0) {
            return null;
        }
        const words = raceWords(facts.direction);
        const { openedAt, smaAtOpen, reachedAtHour } = facts.reclaimedYesterday;
        return {
            id: 'ma-reclaimed',
            label: 'MA reclaimed',
            message:
                `Yesterday opened at ${openedAt.toFixed(2)}, ${words.badSide} the hourly ${period()} SMA (${smaAtOpen.toFixed(2)}), and reached it in the ${reachedAtHour}:00 candle. ` +
                `Today ${formatPct(facts.reclaimSmaCushionPct)} ${words.goodSide} it (${facts.reclaimSma.toFixed(2)}).`,
        };
    },
};

export const highlightRules: IHighlightRule[] = [maReclaimed];
