import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IWarningRule } from './race-rule.types';
import { formatPct, raceWords } from './race-words';

// Warnings do not change the score; they tell the trader what to look at. "danger" marks the stock at risk.

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
                message: `Very stretched: ${formatPct(facts.smaCushionPct)} from the 20 SMA (${facts.smaStretchAtr.toFixed(1)} ATR) — high pullback risk`,
            };
        }
        if (facts.smaStretchAtr >= stretchedAtr) {
            return {
                id: 'stretched-from-sma',
                level: 'caution',
                label: 'Stretched',
                message: `Stretched: ${formatPct(facts.smaCushionPct)} from the 20 SMA (${facts.smaStretchAtr.toFixed(1)} ATR) — pullback risk`,
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
                  label: 'Under SMA',
                  message: `Trading ${raceWords(facts.direction).badSide} the 20 SMA in the ${facts.hourlyCandles[facts.hourlyCandles.length - 1].hour}:00 candle — out if it closes there`,
              }
            : null,
};

export const warningRules: IWarningRule[] = [stretchedFromSma, tradingThroughSma];
