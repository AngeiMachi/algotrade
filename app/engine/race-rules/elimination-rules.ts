import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IEliminationRule } from './race-rule.types';
import { raceWords } from './race-words';

// Elimination rules are permanent: the first one that fires knocks the stock out for the rest of the day.

const tolerance = () => RaceRulesConfig.smaTolerancePct;
const smaPeriod = () => globalConfig.PremarketRace.smaPeriod;

export const hourlyCloseThroughSma: IEliminationRule = {
    id: 'hourly-close-through-sma',
    title: 'Hourly close through the 20 SMA',
    describe: () =>
        `Out for the day once any pre-market hourly candle closes more than ${tolerance()}% ${raceWords(globalConfig.PremarketRace.direction).badSide} the ${smaPeriod()} SMA. Touching it is fine; closing through it is not.`,
    check: (facts) => {
        const brokenCandle = facts.hourlyCandles.find((candle) => candle.complete && candle.closeVsSmaPct < -tolerance());
        if (!brokenCandle) {
            return null;
        }
        return {
            time: `${brokenCandle.hour}:00`,
            reason: `Hourly close ${raceWords(facts.direction).badSide} the ${smaPeriod()} SMA`,
        };
    },
};

// Opening past yesterday's high (long) also means opening past yesterday's close, so this covers both.
// Exception: a stock that reclaims the hourly 200 SMA on the open stays (with the "Opens below" warning).
export const openedInsidePreviousRange: IEliminationRule = {
    id: 'opened-inside-previous-range',
    title: "Opened inside yesterday's range",
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `At the bell, a stock must open ${words.goodSide} ${words.previousExtreme}. Opening ${words.badSide} (or at) it is out — unless it reclaimed the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA on the open.`;
    },
    check: (facts) => {
        if (!facts.isAfterBell || facts.openingVsPreviousExtremePct === null || facts.openingVsPreviousExtremePct > 0 || facts.reclaimedSma) {
            return null;
        }
        const words = raceWords(facts.direction);
        return {
            time: facts.bellTime,
            reason: `Opened ${words.badSide} ${words.previousExtreme}`,
        };
    },
};

export const eliminationRules: IEliminationRule[] = [hourlyCloseThroughSma, openedInsidePreviousRange];
