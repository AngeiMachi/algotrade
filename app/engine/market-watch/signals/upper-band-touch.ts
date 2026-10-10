import * as _ from 'lodash';
import moment from 'moment-timezone';

import { MarketWatchConfig } from '../../../config/market-watch.config';
import { RaceRulesConfig } from '../../../config/race-rules.config';
import { dailyBollingerBand } from '../../race-rules/race-facts';
import { IMarketAlert, IWatchBar, IWatchFacts, IWatchSignal } from '../market-watch.types';

// A stock that opened above the daily upper Bollinger band comes back down to it during the session.
// What matters is how it got there (the trader's observation):
//   - fast: it fell to the band in a few candles (1 to 4, sometimes more, but quickly) → it tends to jump back up.
//   - slow: it slid down candle after candle (~10) and arrived gently → it tends to keep sliding through.
// The band moves with the price, as on the live daily chart: the last 19 daily closes plus the price as today's close.

const NEW_YORK = 'America/New_York';
// "Near the high" for counting how long the descent took: within the top fifth of the way down.
const NEAR_TOP_SHARE = 0.8;

export type TouchVerdict = 'fast' | 'slow' | 'heavy' | 'opening' | 'unclear';

export interface IBandTouch {
    index: number; // the touch candle in facts.bars
    bar: IWatchBar;
    level: number; // the price where the candle met the band
    top: number; // highest price since the stock was armed
    dropAtr: number; // top → level, in daily ATRs
    recentDropAtr: number; // the fall over the last `recentCandles` candles, in daily ATRs
    recentShare: number; // recentDropAtr ÷ dropAtr: how much of the way down came at the end
    descentCandles: number; // candles since the price was last near the top
    lowerHighShare: number; // share of those candles that made a lower high (a staircase down)
    volumeRatio: number | null; // volume of the recent candles vs the session's median candle before them
    minutesFromOpen: number; // when the touch candle started, after the bell
    meaningful: boolean; // the price had been far enough above the band (else it was hugging it)
    verdict: TouchVerdict;
}

const settings = () => MarketWatchConfig.upperBandTouch;

const bandAt = (facts: IWatchFacts, price: number) => dailyBollingerBand(facts.priorDailyCloses, price, 'long') as number;
// How far the price is above the band drawn with that price as today's close, in daily ATRs (negative = under it).
const atrAboveBand = (facts: IWatchFacts, price: number) => ((price - bandAt(facts, price)) / price) * 100 / facts.atrPct;
const toAtr = (facts: IWatchFacts, from: number, to: number) => ((from - to) / to) * 100 / facts.atrPct;

// The price where the band was met inside a candle that went from `above` down to `low`. The gap to the band shrinks
// steadily as the price falls (the band follows the price at only ~1/4 its speed), so halving the range finds it.
const touchLevel = (facts: IWatchFacts, above: number, low: number): number => {
    if (atrAboveBand(facts, above) <= 0) {
        return above;
    }
    let [high, lowBound] = [above, low];
    for (let step = 0; step < 40; step++) {
        const middle = (high + lowBound) / 2;
        if (atrAboveBand(facts, middle) > 0) {
            high = middle;
        } else {
            lowBound = middle;
        }
    }
    return (high + lowBound) / 2;
};

const opensAboveBand = (facts: IWatchFacts) =>
    facts.openingPrice !== null && facts.priorDailyCloses.length >= RaceRulesConfig.bollinger.periodDays - 1 && atrAboveBand(facts, facts.openingPrice) > 0;

// Every touch of the day so far. Armed at the open; after a touch it re-arms once a closed candle is far enough above.
export const findBandTouches = (facts: IWatchFacts): IBandTouch[] => scanBand(facts).touches;

const scanBand = (facts: IWatchFacts): { touches: IBandTouch[]; armed: boolean } => {
    if (!opensAboveBand(facts) || facts.atrPct <= 0) {
        return { touches: [], armed: false };
    }
    const { bars } = facts;
    const touches: IBandTouch[] = [];
    let armedAt: number | null = 0;
    let top = facts.openingPrice as number;

    bars.forEach((bar, index) => {
        if (armedAt === null) {
            if (!bar.forming && atrAboveBand(facts, bar.close) >= settings().rearmAtr) {
                armedAt = index;
                top = bar.high;
            }
            return;
        }
        if (atrAboveBand(facts, bar.low) > 0) {
            top = Math.max(top, bar.high);
            return;
        }
        touches.push(describeTouch(facts, index, armedAt, Math.max(top, bar.open)));
        armedAt = null;
    });
    return { touches, armed: armedAt !== null };
};

const describeTouch = (facts: IWatchFacts, index: number, armedAt: number, top: number): IBandTouch => {
    const { bars } = facts;
    const bar = bars[index];
    const { recentCandles, minExcursionAtr } = settings();
    const level = touchLevel(facts, index > 0 ? Math.max(bar.open, bars[index - 1].close) : bar.open, bar.low);

    const recentBars = bars.slice(Math.max(armedAt, index - recentCandles + 1), index);
    const recentTop = Math.max(bar.open, ...recentBars.map((recent) => recent.high));
    const dropAtr = toAtr(facts, top, level);
    const recentDropAtr = toAtr(facts, Math.min(recentTop, top), level);

    const nearTop = level + NEAR_TOP_SHARE * (top - level);
    const lastNearTop = _.findLastIndex(bars, (candidate, position) => position >= armedAt && position < index && candidate.high >= nearTop);
    const descentStart = bar.open >= nearTop || lastNearTop < 0 ? index : lastNearTop;
    const descentCandles = Math.max(1, index - descentStart);
    const descent = bars.slice(descentStart, index + 1);
    const lowerHighs = descent.slice(1).filter((candle, position) => candle.high < descent[position].high).length;

    const before = bars.slice(0, Math.max(0, index - recentCandles + 1));
    const volumeRatio = before.length >= 6 ? _.meanBy([...recentBars, bar], 'volume') / median(before.map((candle) => candle.volume)) : null;

    const touch = {
        index,
        bar,
        level,
        top,
        dropAtr,
        recentDropAtr,
        recentShare: dropAtr > 0 ? recentDropAtr / dropAtr : 1,
        descentCandles,
        lowerHighShare: descent.length > 1 ? lowerHighs / (descent.length - 1) : 0,
        volumeRatio,
        minutesFromOpen: index * 5,
        meaningful: dropAtr >= minExcursionAtr,
        verdict: 'unclear' as TouchVerdict,
    };
    touch.verdict = judge(touch);
    return touch;
};

// Order matters: heavy selling outweighs speed, and a fast drop only counts in the bounce window.
export const judge = (touch: Pick<IBandTouch, 'recentDropAtr' | 'recentShare' | 'descentCandles' | 'minutesFromOpen' | 'volumeRatio'>): TouchVerdict => {
    const { fastDropAtr, fastShare, fastFromMinute, fastUntilMinute, heavyVolumeRatio, slideMinCandles, slideMaxRecentDropAtr } = settings();
    if (touch.volumeRatio !== null && touch.volumeRatio >= heavyVolumeRatio) {
        return 'heavy';
    }
    if (touch.minutesFromOpen < fastFromMinute) {
        return 'opening';
    }
    if (touch.recentDropAtr >= fastDropAtr && touch.recentShare >= fastShare && touch.minutesFromOpen < fastUntilMinute) {
        return 'fast';
    }
    if (touch.descentCandles >= slideMinCandles && touch.recentDropAtr < slideMaxRecentDropAtr) {
        return 'slow';
    }
    return 'unclear';
};

const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 || 1;
};

const VERDICT_TEXT: { [verdict in TouchVerdict]: { tone: IMarketAlert['tone']; title: string; outlook: string } } = {
    fast: { tone: 'opportunity', title: 'Fast drop to the upper BB', outlook: 'Fell fast into the band: bounced first 57% of the time, kept falling 38%.' },
    slow: { tone: 'caution', title: 'Slow slide to the upper BB', outlook: 'Slid slowly into the band: tends to keep sliding through it.' },
    heavy: { tone: 'caution', title: 'Heavy selling into the upper BB', outlook: 'Heavy volume on the way down is real selling: rarely bounced.' },
    opening: { tone: 'info', title: 'Opening dip to the upper BB', outlook: 'First 15 minutes after the bell: opening chop, no edge.' },
    unclear: { tone: 'info', title: 'Touched the upper BB', outlook: 'Neither a fast drop nor a slow slide: no edge.' },
};

const candles = (count: number) => `${count} ${count === 1 ? 'candle' : 'candles'}`;

const toAlert = (facts: IWatchFacts, touch: IBandTouch): IMarketAlert => {
    const text = VERDICT_TEXT[touch.verdict];
    const { recentCandles } = settings();
    return {
        id: `upper-band-touch:${facts.quote}:${touch.bar.key}`,
        signal: upperBandTouch.id,
        quote: facts.quote,
        tone: text.tone,
        title: text.title,
        summary: text.outlook,
        message: `Came down to the daily upper BB at ${touch.level.toFixed(2)}: ${touch.dropAtr.toFixed(2)} ATR from its high in ${candles(touch.descentCandles)}.`,
        details: [
            `Fell ${touch.recentDropAtr.toFixed(2)} ATR in the last ${candles(Math.min(recentCandles, touch.index + 1))} (${Math.round(touch.recentShare * 100)}% of the way down)`,
            `High since the open or last re-arm ${touch.top.toFixed(2)}; ${Math.round(touch.lowerHighShare * 100)}% of the descent candles made a lower high`,
            touch.volumeRatio === null ? 'Too early in the session to compare volume' : `Volume on the way down ${touch.volumeRatio.toFixed(1)}× a typical candle today`,
        ],
        candle: touch.bar.time,
        timeIso: moment.tz(touch.bar.key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).toISOString(),
        price: touch.level,
    };
};

export const upperBandTouch: IWatchSignal = {
    id: 'upper-band-touch',
    title: 'Back to the upper Bollinger band',
    describe: () => {
        const { fastDropAtr, fastShare, fastFromMinute, fastUntilMinute, heavyVolumeRatio, recentCandles, slideMinCandles, slideMaxRecentDropAtr, minExcursionAtr, rearmAtr } =
            settings();
        return (
            `Watches every stock that opened above the daily upper Bollinger band and alerts when the price comes back down to it ` +
            `(after being at least ${minExcursionAtr} ATR above). Fast drop — at least ${fastDropAtr} ATR in the last ${recentCandles} candles, ` +
            `${Math.round(fastShare * 100)}% of the way down or more, between ${fastFromMinute} and ${fastUntilMinute} minutes after the bell — tends to bounce ` +
            `(popup and chime). Slow slide — ${slideMinCandles}+ candles down, under ${slideMaxRecentDropAtr} ATR in the last ${recentCandles} — tends to keep going. ` +
            `Heavy volume on the way down (${heavyVolumeRatio}× a typical candle) is real selling. Re-arms after a candle closes ${rearmAtr} ATR above the band.`
        );
    },
    watches: opensAboveBand,
    detect: (facts) =>
        findBandTouches(facts)
            .filter((touch) => touch.meaningful)
            .map((touch) => toAlert(facts, touch)),
    status: (facts) => {
        if (!opensAboveBand(facts)) {
            return null;
        }
        const last = _.last(facts.bars);
        const price = last ? last.close : (facts.openingPrice as number);
        const distance = atrAboveBand(facts, price);
        const { touches, armed } = scanBand(facts);
        return {
            quote: facts.quote,
            signal: upperBandTouch.id,
            state: armed ? 'Armed' : `Touched ${touches.length}×`,
            note:
                `${distance >= 0 ? `${distance.toFixed(2)} ATR above` : `${(-distance).toFixed(2)} ATR below`} the BB (${bandAt(facts, price).toFixed(2)})` +
                (armed ? '' : ` · re-arms at +${settings().rearmAtr}`),
        };
    },
};
