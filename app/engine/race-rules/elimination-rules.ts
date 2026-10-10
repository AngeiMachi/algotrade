import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IEliminationRule } from './race-rule.types';
import { raceWords } from './race-words';
import { nearPreviousExtreme } from './near-previous-extreme';

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
// Exceptions: a stock that reclaims the hourly 200 SMA on the open ("Opened below high"), and a healthy stock that opens
// just under the high with conviction ("Near high", see near-previous-extreme).
export const openedInsidePreviousRange: IEliminationRule = {
    id: 'opened-inside-previous-range',
    title: "Opened inside yesterday's range",
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        const { maxShortfallAtr, minGapAtr } = RaceRulesConfig.nearPreviousExtreme;
        return `At the bell, a stock must open ${words.goodSide} ${words.previousExtreme}. Opening ${words.badSide} (or at) it is out — unless it reclaimed the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA on the open, or it opened at most ${maxShortfallAtr} ATR under it while holding the 20 SMA and either ${minGapAtr} ATR ${words.goodSide} yesterday's close or on ${RaceRulesConfig.relativeVolume.trendingAt}× normal volume.`;
    },
    check: (facts) => {
        if (
            !facts.isAfterBell ||
            facts.openingVsPreviousExtremePct === null ||
            facts.openingVsPreviousExtremePct > 0 ||
            facts.reclaimedSma ||
            nearPreviousExtreme(facts)
        ) {
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
