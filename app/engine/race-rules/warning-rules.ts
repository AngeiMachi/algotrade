import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IWarningRule } from './race-rule.types';
import { formatPct, raceWords } from './race-words';
import { nearPreviousExtreme } from './near-previous-extreme';

// Warnings do not change the score; they tell the trader what to look at. "danger" shows red;
// tradingThroughSma also marks the stock at risk.

const { stretchedAtr, extremeAtr } = RaceRulesConfig.warnings;

export const stretchedFromSma: IWarningRule = {
    id: 'stretched-from-sma',
    title: 'Stretched from the 20 SMA',
    describe: () =>
        `Warns when the price is ${stretchedAtr} daily ATR or more from the SMA — strong, but prone to pulling back toward it. From ${extremeAtr} ATR the move is in rare territory.`,
    check: (facts) => {
        if (facts.smaStretchAtr >= extremeAtr) {
            return {
                id: 'stretched-from-sma',
                level: 'alert',
                label: 'Very stretched',
                message: `Very stretched: ${formatPct(facts.smaCushionPct)} from the 20 SMA (${facts.smaStretchAtr.toFixed(2)} ATR) — high pullback risk`,
            };
        }
        if (facts.smaStretchAtr >= stretchedAtr) {
            return {
                id: 'stretched-from-sma',
                level: 'caution',
                label: 'Stretched',
                message: `Stretched: ${formatPct(facts.smaCushionPct)} from the 20 SMA (${facts.smaStretchAtr.toFixed(2)} ATR) — pullback risk`,
            };
        }
        return null;
    },
};

export const tradingThroughSma: IWarningRule = {
    id: 'trading-through-sma',
    title: 'Trading through the 20 SMA',
    describe: () =>
        `Warns while the price is ${raceWords(globalConfig.PremarketRace.direction).badSide} the SMA inside an open hourly candle. If the candle closes there, the stock is out.`,
    check: (facts) =>
        facts.smaCushionPct < -RaceRulesConfig.smaTolerancePct
            ? {
                  id: 'trading-through-sma',
                  level: 'danger',
                  label: 'Under 20 SMA',
                  message: facts.isAfterBell
                      ? `Opened ${raceWords(facts.direction).badSide} the 20 SMA, inside the ${facts.hourlyCandles[facts.hourlyCandles.length - 1].hour}:00 hourly candle (still forming; not an hourly close)`
                      : `Trading ${raceWords(facts.direction).badSide} the 20 SMA in the ${facts.hourlyCandles[facts.hourlyCandles.length - 1].hour}:00 candle — out if it closes there`,
              }
            : null,
};

// Only two kinds of stock race on the bad side of yesterday's high (see openedInsidePreviousRange): healthy ones just
// under it ("Near high") and reclaimers of the hourly 200 SMA ("Opened below high").
export const nearPreviousExtremeWarning: IWarningRule = {
    id: 'near-previous-extreme',
    title: "Just under yesterday's high",
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `A healthy stock racing a hair ${words.badSide} ${words.previousExtreme} (within normal noise) is marked "Near high".`;
    },
    check: (facts) => {
        const near = nearPreviousExtreme(facts);
        if (!near || facts.previousExtreme === null) {
            return null;
        }
        const words = raceWords(facts.direction);
        return {
            id: 'near-previous-extreme',
            level: 'caution',
            label: 'Near high',
            message:
                `${facts.isAfterBell ? 'Opened' : 'Trading'} ${near.shortfallPct.toFixed(2)}% under ${words.previousExtreme} (${facts.previousExtreme.toFixed(2)}), ` +
                `only ${near.shortfallAtr.toFixed(2)} ATR — within normal noise. Kept: holding the 20 SMA, ${near.conviction}.`,
        };
    },
};

export const belowPreviousExtreme: IWarningRule = {
    id: 'below-previous-extreme',
    title: "Below yesterday's high",
    describe: () => {
        const words = raceWords(globalConfig.PremarketRace.direction);
        return `A stock racing ${words.badSide} ${words.previousExtreme} only because it reclaimed the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA is marked "Opened below high" (before the bell: "Below high").`;
    },
    check: (facts) => {
        const pastPct = facts.isAfterBell ? facts.openingVsPreviousExtremePct : facts.previousExtremeCushionPct;
        if (pastPct === null || pastPct > 0 || facts.previousExtreme === null || nearPreviousExtreme(facts)) {
            return null;
        }
        const words = raceWords(facts.direction);
        return {
            id: 'below-previous-extreme',
            level: 'danger',
            label: facts.isAfterBell ? 'Opened below high' : 'Below high',
            message: `${facts.isAfterBell ? 'Opened' : 'Trading'} ${formatPct(pastPct)} vs ${words.previousExtreme} (${facts.previousExtreme.toFixed(2)}) — in the race only because it reclaimed the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA`,
        };
    },
};

export const warningRules: IWarningRule[] = [stretchedFromSma, tradingThroughSma, nearPreviousExtremeWarning, belowPreviousExtreme];
