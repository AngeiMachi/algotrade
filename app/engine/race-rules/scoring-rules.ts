import { RaceRulesConfig } from '../../config/race-rules.config';
import * as globalConfig from '../../config/globals.config';
import { IRaceFacts, IScoreFactor, IScoringRule } from './race-rule.types';
import { formatPct, raceWords } from './race-words';

// Each scoring rule returns a factor between 0 and 1. The race ranks by score = 100 × all factors multiplied.

const config = RaceRulesConfig.scoring;

export const gapStrength: IScoringRule = {
    id: 'gap-strength',
    title: 'Gap strength',
    describe: () =>
        `How far the stock moved from yesterday's close, in daily ATRs: tanh(gap ÷ ${config.gap.scaleAtr} ATR). Grows fast for the first ATR, then flattens — a huge gap is not automatically better.`,
    factor: (facts) => ({
        factor: Math.tanh(Math.max(0, facts.gapInAtr) / config.gap.scaleAtr),
        note: `${formatPct(facts.gapPct)} = ${facts.gapInAtr.toFixed(2)} ATR (ATR ${facts.atrPct.toFixed(2)}%)`,
    }),
};

export const smaDistance: IScoringRule = {
    id: 'sma-distance',
    title: 'Distance from the 20 SMA',
    describe: () =>
        `How stretched the price is from the hourly 20 SMA, in daily ATRs. Full marks within ${config.smaDistance.comfortAtr} ATR, then it fades like a bell curve: 1 ATR keeps 61%, 1.5 ATR keeps 14%. Close to the SMA is healthy; far from it tends to pull back.`,
    factor: (facts) => {
        const beyondComfort = Math.max(0, facts.smaStretchAtr - config.smaDistance.comfortAtr) / config.smaDistance.decayAtr;
        return {
            factor: Math.exp(-0.5 * beyondComfort ** 2),
            note: `${formatPct(facts.smaCushionPct)} ${raceWords(facts.direction).goodSide} the SMA = ${facts.smaStretchAtr.toFixed(2)} ATR`,
        };
    },
};

export const smaSlope: IScoringRule = {
    id: 'sma-slope',
    title: 'Angle of the 20 SMA',
    describe: () => {
        const { lookbackHours } = config.smaSlope;
        const up = globalConfig.PremarketRace.direction === 'long' ? 'up' : 'down';
        return `Which way the hourly 20 SMA points going into the open: how far it moved over the last ${lookbackHours} completed hours, in daily ATRs. Pointing ${up} 0.3 ATR or more keeps full marks, barely moving keeps about 60%, flat about a third, pointing the wrong way a quarter.`;
    },
    factor: (facts) => {
        if (facts.smaSlopeAtr === null || facts.smaSlopePct === null) {
            return { factor: 1, note: 'Not enough hourly history to measure' };
        }
        const { midpointAtr, widthAtr, floor } = config.smaSlope;
        const rising = (1 + Math.tanh((facts.smaSlopeAtr - midpointAtr) / widthAtr)) / 2;
        return {
            factor: floor + (1 - floor) * rising,
            note: `${formatPct(facts.smaSlopePct)} over ${config.smaSlope.lookbackHours}h = ${facts.smaSlopeAtr >= 0 ? '+' : ''}${facts.smaSlopeAtr.toFixed(2)} ATR`,
        };
    },
};

export const underLongSma: IScoringRule = {
    id: 'under-long-sma',
    title: `Under the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA`,
    describe: () =>
        `If the price is ${raceWords(globalConfig.PremarketRace.direction).badSide} the hourly ${RaceRulesConfig.reclaim.smaPeriod} SMA, the score is multiplied by ${config.underLongSma.factor}. This weighs more than the angle of the 20 SMA: a gentle rise above the ${RaceRulesConfig.reclaim.smaPeriod} beats a steep one under it.`,
    factor: (facts) => {
        if (facts.belowReclaimSma === null || facts.reclaimSma === null) {
            return { factor: 1, note: 'Not enough hourly history to measure' };
        }
        const side = raceWords(facts.direction);
        const cushion = `${formatPct(facts.reclaimSmaCushionPct as number)} vs ${facts.reclaimSma.toFixed(2)}`;
        return facts.belowReclaimSma
            ? { factor: config.underLongSma.factor, note: `Price ${side.badSide} it (${cushion})` }
            : { factor: 1, note: `Price ${side.goodSide} it (${cushion})` };
    },
};

export const holdQuality: IScoringRule = {
    id: 'hold-quality',
    title: 'Clean hold of the 20 SMA',
    describe: () =>
        `Clean stocks keep full marks. Every pre-market hourly wick that dipped ${raceWords(globalConfig.PremarketRace.direction).badSide} the SMA multiplies the score by ${config.hold.touchFactor}.`,
    factor: (facts) => ({
        factor: config.hold.touchFactor ** facts.smaTouches,
        note: facts.smaTouches === 0 ? 'Clean' : `Touched ${facts.smaTouches}×`,
    }),
};

export const underSmaNow: IScoringRule = {
    id: 'under-sma-now',
    title: 'Under the 20 SMA right now',
    describe: () =>
        `If the price is ${raceWords(globalConfig.PremarketRace.direction).badSide} the SMA while the hourly candle is still open, the score is multiplied by ${config.underSmaNow.factor} until it recovers.`,
    factor: (facts) =>
        facts.smaCushionPct < -RaceRulesConfig.smaTolerancePct
            ? { factor: config.underSmaNow.factor, note: `${formatPct(facts.smaCushionPct)} through the SMA` }
            : { factor: 1, note: 'Holding the SMA' },
};

export const scoringRules: IScoringRule[] = [gapStrength, smaDistance, smaSlope, underLongSma, holdQuality, underSmaNow];

export const scoreRacer = (facts: IRaceFacts): { score: number; breakdown: IScoreFactor[] } => {
    const breakdown = scoringRules.map((rule) => ({ rule: rule.title, ...rule.factor(facts) }));
    const score = 100 * breakdown.reduce((product, line) => product * line.factor, 1);
    return { score: Math.round(score * 10) / 10, breakdown };
};
