import { RaceRulesConfig } from '../../config/race-rules.config';
import { IRaceFacts } from './race-rule.types';
import { formatPct } from './race-words';

// "Near high": a stock just under yesterday's high (long; low for short) is not discredited when it is healthy on
// the hourly chart and shows conviction. Used by the qualification, elimination and warning rules.

export interface INearPreviousExtreme {
    shortfallPct: number; // how far under yesterday's high, as a positive percent
    shortfallAtr: number;
    conviction: string; // why it earned the exception, for the badge tooltip
}

export const nearPreviousExtreme = (facts: IRaceFacts): INearPreviousExtreme | null => {
    const { maxShortfallAtr, minGapAtr } = RaceRulesConfig.nearPreviousExtreme;
    // After the bell `price` is the open, so this is the opening shortfall.
    if (facts.previousExtremeCushionPct === null || facts.previousExtremeCushionPct > 0) {
        return null;
    }
    const atrPct = facts.atrPct > 0 ? facts.atrPct : RaceRulesConfig.fallbackAtrPct;
    const shortfallPct = -facts.previousExtremeCushionPct;
    const shortfallAtr = shortfallPct / atrPct;
    const healthyOnHourly = facts.smaCushionPct >= -RaceRulesConfig.smaTolerancePct;
    if (shortfallAtr > maxShortfallAtr || !healthyOnHourly) {
        return null;
    }

    const { trendingAt, fromTime } = RaceRulesConfig.relativeVolume;
    const strongGap = facts.gapPct / atrPct >= minGapAtr;
    const unusualVolume = facts.relativeVolume !== null && facts.relativeVolume >= trendingAt && facts.lastCandle >= fromTime;
    if (!strongGap && !unusualVolume) {
        return null;
    }
    const reasons = [
        strongGap ? `${formatPct(facts.gapPct)} from yesterday's close (${(facts.gapPct / atrPct).toFixed(2)} ATR)` : null,
        unusualVolume ? `${(facts.relativeVolume as number).toFixed(1)}× normal pre-market volume` : null,
    ].filter(Boolean);
    return { shortfallPct, shortfallAtr, conviction: reasons.join(' and ') };
};
