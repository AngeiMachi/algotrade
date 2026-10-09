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

export const openedThroughPreviousClose: IEliminationRule = {
    id: 'opened-through-previous-close',
    title: "Opened on the wrong side of yesterday's close",
    describe: () => `At the bell, a stock that opens ${raceWords(globalConfig.PremarketRace.direction).badSide} (or at) yesterday's close is out.`,
    check: (facts) => {
        if (!facts.isAfterBell || facts.openingGapPct === null || facts.openingGapPct > 0) {
            return null;
        }
        return {
            time: facts.bellTime,
            reason: `Opened ${raceWords(facts.direction).badSide} yesterday's close`,
        };
    },
};

export const eliminationRules: IEliminationRule[] = [hourlyCloseThroughSma, openedThroughPreviousClose];
