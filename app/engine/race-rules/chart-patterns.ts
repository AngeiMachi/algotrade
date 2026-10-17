import * as _ from 'lodash';
import moment from 'moment-timezone';

import { RaceRulesConfig } from '../../config/race-rules.config';

// Classic bullish chart patterns on the daily chart, found the way a trader draws them: swing highs and lows, a
// resistance line through three or more swing highs that no close has crossed, and the support under it. The shape of
// the two lines names the pattern; today's price (the open, after the bell) against the resistance says whether it is
// breaking out. Detection only: nothing here is back-tested. Every distance is in daily ATRs at yesterday's close.

export interface IDailyCandle {
    date: string; // New York 'YYYY-MM-DD'
    open: number;
    high: number;
    low: number;
    close: number;
}

export type ChartPatternKind =
    | 'falling-wedge'
    | 'descending-triangle'
    | 'symmetrical-triangle'
    | 'ascending-triangle'
    | 'range'
    | 'trendline'
    | 'resistance'
    | 'bull-flag'
    | 'double-bottom';

export const PATTERN_NAMES: { [kind in ChartPatternKind]: string } = {
    'falling-wedge': 'Falling wedge',
    'descending-triangle': 'Descending triangle',
    'symmetrical-triangle': 'Symmetrical triangle',
    'ascending-triangle': 'Ascending triangle',
    range: 'Range',
    trendline: 'Falling trendline',
    resistance: 'Resistance',
    'bull-flag': 'Bull flag',
    'double-bottom': 'Double bottom',
};

export interface IChartPattern {
    kind: ChartPatternKind;
    level: number; // the breakout level today (the resistance line extended to today, the flag top, the neckline)
    distanceAtr: number; // today's price vs that level; positive = above it
    state: 'breakout' | 'near';
    since: string; // the pattern's first date
    days: number; // from its first point to yesterday
    touches: number; // swing highs on the resistance (flag and double bottom: their defining points)
    description: string; // how it is drawn, with the numbers
    day?: 2; // set on the session after the breakout
}

// A pattern as drawn on the chart up to yesterday, before today's price is known.
type IPatternSetup = Omit<IChartPattern, 'distanceAtr' | 'state'>;

// A straight line over candle indexes: value(i) = start + slope × (i − from).
interface ILine {
    from: number;
    start: number;
    slope: number;
    touches: number[];
}

const settings = () => RaceRulesConfig.chartPatterns;
const valueAt = (line: ILine, index: number) => line.start + line.slope * (index - line.from);

// Swing highs (or lows): the extreme of the `span` candles on each side. Needs `span` candles after it to be sure.
const pivots = (candles: IDailyCandle[], side: 'high' | 'low'): number[] => {
    const { pivotSpan } = settings();
    const better = (a: number, b: number) => (side === 'high' ? a > b : a < b);
    const result: number[] = [];
    for (let i = pivotSpan; i < candles.length - pivotSpan; i++) {
        const value = candles[i][side];
        const window = _.range(i - pivotSpan, i + pivotSpan + 1).filter((j) => j !== i);
        if (window.every((j) => !better(candles[j][side], value) && (j > i || candles[j][side] !== value))) {
            result.push(i);
        }
    }
    return result;
};

// Touches the way a trader counts them: any candle reaching the line (`price` within touchAtr), a touch at least
// pivotSpan days after the one before (the candles of one test count once).
const touchesOf = (candles: IDailyCandle[], line: ILine, atr: number, price: (candle: IDailyCandle) => number, until: number) => {
    const { touchAtr, pivotSpan } = settings();
    const touches: number[] = [];
    for (let i = line.from; i <= until; i++) {
        if (Math.abs(price(candles[i]) - valueAt(line, i)) <= touchAtr * atr && (touches.length === 0 || i - (_.last(touches) as number) >= pivotSpan)) {
            touches.push(i);
        }
    }
    return touches;
};

// Every resistance line through two swing highs that nothing has closed above until yesterday, with its touches.
const resistanceLines = (candles: IDailyCandle[], atr: number): ILine[] => {
    const { minTouches, minSpanDays, maxStaleDays, wickAtr, closeAtr, maxRiseAtrPer20Days } = settings();
    const last = candles.length - 1;
    const highs = pivots(candles, 'high');
    const lines: ILine[] = [];
    highs.forEach((a, position) => {
        highs.slice(position + 1).forEach((b) => {
            const line: ILine = { from: a, start: candles[a].high, slope: (candles[b].high - candles[a].high) / (b - a), touches: [] };
            if ((line.slope * 20) / atr > maxRiseAtrPer20Days) {
                return;
            }
            for (let i = a; i <= last; i++) {
                const value = valueAt(line, i);
                if (candles[i].high > value + wickAtr * atr || candles[i].close > value + closeAtr * atr) {
                    return;
                }
            }
            line.touches = touchesOf(candles, line, atr, (candle) => candle.high, last);
            const lastTouch = _.last(line.touches) as number;
            if (line.touches.length >= minTouches && lastTouch - a >= minSpanDays && last - lastTouch <= maxStaleDays) {
                lines.push(line);
            }
        });
    });
    return lines;
};

// The best support under a resistance: through two swing lows inside the pattern, nothing closed under it since.
const supportLine = (candles: IDailyCandle[], atr: number, resistance: ILine): ILine | null => {
    const { wickAtr, closeAtr } = settings();
    const lows = pivots(candles, 'low').filter((j) => j >= resistance.from);
    const last = candles.length - 1;
    const lines: ILine[] = [];
    lows.forEach((a, position) => {
        lows.slice(position + 1).forEach((b) => {
            const line: ILine = { from: a, start: candles[a].low, slope: (candles[b].low - candles[a].low) / (b - a), touches: [] };
            for (let i = a; i <= last; i++) {
                const value = valueAt(line, i);
                if (candles[i].low < value - wickAtr * atr || candles[i].close < value - closeAtr * atr) {
                    return;
                }
            }
            line.touches = touchesOf(candles, line, atr, (candle) => candle.low, last);
            lines.push(line);
        });
    });
    return _.maxBy(lines, (line) => line.touches.length * 1000 + ((_.last(line.touches) as number) - line.from)) ?? null;
};

// The shape of the two lines. Flat = moves less than flatAtrPer20Days over 20 days.
const classify = (resistance: ILine, support: ILine | null, atr: number): ChartPatternKind => {
    const { flatAtrPer20Days } = settings();
    const trend = (line: ILine) => {
        const per20 = (line.slope * 20) / atr;
        return per20 > flatAtrPer20Days ? 'up' : per20 < -flatAtrPer20Days ? 'down' : 'flat';
    };
    const top = trend(resistance);
    const bottom = support ? trend(support) : null;
    if (top === 'flat') {
        return bottom === 'up' ? 'ascending-triangle' : bottom === 'flat' ? 'range' : 'resistance';
    }
    if (bottom === 'flat') {
        return 'descending-triangle';
    }
    if (bottom === 'up') {
        return 'symmetrical-triangle';
    }
    if (bottom === 'down' && support && support.slope > resistance.slope) {
        return 'falling-wedge';
    }
    return 'trendline';
};

const formatDate = (date: string) => moment(date).format('MMM D');
const stateOf = (distanceAtr: number): 'breakout' | 'near' | null =>
    distanceAtr >= settings().breakoutAtr ? 'breakout' : distanceAtr >= -settings().nearAtr ? 'near' : null;

// The resistance-line patterns (trendline, triangles, wedge, range): every valid line, each named with its support.
// Which one counts is decided at today's price (a line it is breaking out of beats one it is far under), so the
// steep line from a top is not hidden by a flatter one with more touches (CSCO Oct 2).
const linePatterns = (candles: IDailyCandle[], atr: number): IPatternSetup[] => {
    const lines = _.orderBy(resistanceLines(candles, atr), [(line) => line.touches.length, (line) => (_.last(line.touches) as number) - line.from], ['desc', 'desc']);
    const today = candles.length;
    const per20 = (line: ILine) => `${line.slope >= 0 ? '+' : ''}${((line.slope * 20) / atr).toFixed(1)} ATR a month`;
    return _.take(lines, settings().maxLines).map((resistance) => {
        const level = valueAt(resistance, today);
        const support = supportLine(candles, atr, resistance);
        return {
            kind: classify(resistance, support, atr),
            level,
            since: candles[resistance.from].date,
            days: today - 1 - resistance.from,
            touches: resistance.touches.length,
            description:
                `Resistance from ${formatDate(candles[resistance.from].date)} (${candles[resistance.from].high.toFixed(2)}) ` +
                `touched ${resistance.touches.length}× (${resistance.touches.map((i) => formatDate(candles[i].date)).join(', ')}; ${per20(resistance)}), ` +
                `${level.toFixed(2)} today` +
                (support ? `; support touched ${support.touches.length}× (${per20(support)})` : ''),
        };
    });
};

// A sharp run-up (the pole) and a short, shallow pullback under its top (the flag). Breakout = above the flag's highs.
const bullFlag = (candles: IDailyCandle[], atr: number): IPatternSetup | null => {
    const { minPoleAtr, maxPoleDays, minFlagDays, maxFlagDays, maxRetrace } = settings().bullFlag;
    const today = candles.length;
    const found: IPatternSetup[] = [];
    for (let top = today - maxFlagDays - 1; top <= today - minFlagDays - 1; top++) {
        if (top < maxPoleDays) {
            continue;
        }
        const flag = candles.slice(top + 1);
        const poleCandles = candles.slice(top - maxPoleDays, top);
        const poleLow = _.minBy(poleCandles, 'low')!.low;
        const poleTop = candles[top].high;
        const pole = poleTop - poleLow;
        const flagHigh = _.maxBy(flag, 'high')!.high;
        const flagLow = _.minBy(flag, 'low')!.low;
        if (pole / atr < minPoleAtr || flagHigh > poleTop || flagLow < poleTop - maxRetrace * pole) {
            continue;
        }
        found.push({
            kind: 'bull-flag',
            level: flagHigh,
            since: candles[top].date,
            days: flag.length,
            touches: 0,
            description:
                `Pole +${(pole / atr).toFixed(1)} ATR to ${poleTop.toFixed(2)} (${formatDate(candles[top].date)}), then ${flag.length} days of flag ` +
                `giving back ${Math.round(((poleTop - flagLow) / pole) * 100)}% of the pole; flag top ${flagHigh.toFixed(2)}`,
        });
    }
    return _.maxBy(found, (pattern) => pattern.days) ?? null;
};

// Two lows at about the same price with a real bounce between them; breakout = above the high between (the neckline).
const doubleBottom = (candles: IDailyCandle[], atr: number): IPatternSetup | null => {
    const { minGapDays, maxRecentDays, sameLowAtr, minDepthAtr } = settings().doubleBottom;
    const lows = pivots(candles, 'low');
    const last = candles.length - 1;
    const found: IPatternSetup[] = [];
    lows.forEach((first) => {
        lows.forEach((second) => {
            if (second - first < minGapDays || last - second > maxRecentDays || Math.abs(candles[first].low - candles[second].low) > sameLowAtr * atr) {
                return;
            }
            const between = candles.slice(first + 1, second);
            const neckIndex = first + 1 + between.indexOf(_.maxBy(between, 'high')!);
            const neckline = candles[neckIndex].high;
            const bottom = Math.min(candles[first].low, candles[second].low);
            const afterNeck = candles.slice(neckIndex + 1);
            if (
                (neckline - bottom) / atr < minDepthAtr ||
                afterNeck.some((candle) => candle.close > neckline) ||
                candles.slice(first).some((candle) => candle.low < bottom - sameLowAtr * atr)
            ) {
                return;
            }
            found.push({
                kind: 'double-bottom',
                level: neckline,
                since: candles[first].date,
                days: last - first,
                touches: 2,
                description:
                    `Lows ${candles[first].low.toFixed(2)} (${formatDate(candles[first].date)}) and ${candles[second].low.toFixed(2)} ` +
                    `(${formatDate(candles[second].date)}), neckline ${neckline.toFixed(2)} (${((neckline - bottom) / atr).toFixed(1)} ATR above them)`,
            });
        });
    });
    return _.maxBy(found, (pattern) => pattern.days) ?? null;
};

// The patterns in the order a trader would name them first when several fit.
const PRIORITY: ChartPatternKind[] = [
    'falling-wedge',
    'descending-triangle',
    'symmetrical-triangle',
    'ascending-triangle',
    'trendline',
    'bull-flag',
    'double-bottom',
    'range',
    'resistance',
];

// The chart's patterns up to yesterday, drawn once per stock and day (the race re-reads them on every update).
const setupsCache = new WeakMap<IDailyCandle[], { atr: number; setups: IPatternSetup[] }>();
const setupsOf = (priorCandles: IDailyCandle[], atrPct: number) => {
    const cached = setupsCache.get(priorCandles);
    if (cached) {
        return cached;
    }
    const candles = _.takeRight(priorCandles, settings().lookbackDays);
    const atr = candles.length > 0 ? (atrPct / 100) * (_.last(candles) as IDailyCandle).close : 0;
    const setups = candles.length >= 30 && atr > 0 ? [...linePatterns(candles, atr), ..._.compact([bullFlag(candles, atr), doubleBottom(candles, atr)])] : [];
    const result = { atr, setups };
    setupsCache.set(priorCandles, result);
    return result;
};

const patternsAt = (priorCandles: IDailyCandle[], price: number, atrPct: number): IChartPattern[] => {
    const { atr, setups } = setupsOf(priorCandles, atrPct);
    return setups
        .map((setup) => ({ ...setup, distanceAtr: (price - setup.level) / atr }))
        .map((pattern) => ({ ...pattern, state: stateOf(pattern.distanceAtr) }))
        .filter((pattern): pattern is IChartPattern => pattern.state !== null);
};

interface IRecentBreakout {
    sessionsAgo: number;
    patterns: IChartPattern[]; // the ones it broke out of that day
}

// The first session (within quietDays) that opened breaking out of a pattern and closed above it; a day-2 break of
// another line does not start a new count (CSCO Oct 5). A breakout that closed back under the line failed and does
// not count (AVGO Sep 29, then the real one Oct 5).
const recentBreakoutCache = new WeakMap<IDailyCandle[], IRecentBreakout | null>();
const recentBreakout = (priorCandles: IDailyCandle[], atrPct: number): IRecentBreakout | null => {
    if (!recentBreakoutCache.has(priorCandles)) {
        const heldBreakouts = (index: number) =>
            patternsAt(priorCandles.slice(0, index), priorCandles[index].open, atrPct).filter(
                (pattern) => pattern.state === 'breakout' && priorCandles[index].close > pattern.level
            );
        const recent = _.range(1, settings().quietDays + 1)
            .filter((sessionsAgo) => priorCandles.length - sessionsAgo > 0)
            .map((sessionsAgo) => ({ sessionsAgo, patterns: heldBreakouts(priorCandles.length - sessionsAgo) }))
            .filter(({ patterns }) => patterns.length > 0)
            .pop();
        recentBreakoutCache.set(priorCandles, recent ?? null);
    }
    return recentBreakoutCache.get(priorCandles) as IRecentBreakout | null;
};

// Every pattern breaking out or near its breakout at `price`, breakouts first, then by PRIORITY. A breakout counts on
// its first day and the day after (the trader: CSCO Oct 2 + Oct 5, AVGO Oct 5 + Oct 6), then nothing until
// quietDays sessions passed. Day 2 shows yesterday's breakouts still above their level and any new line broken today.
export const findChartPatterns = (priorCandles: IDailyCandle[], price: number, atrPct: number): IChartPattern[] => {
    const recent = recentBreakout(priorCandles, atrPct);
    if (recent && recent.sessionsAgo > 1) {
        return [];
    }
    const atr = setupsOf(priorCandles, atrPct).atr;
    const today = patternsAt(priorCandles, price, atrPct);
    const found = recent
        ? [
              ...today.filter((pattern) => pattern.state === 'breakout'),
              ...recent.patterns
                  .map((pattern) => ({ ...pattern, distanceAtr: (price - pattern.level) / atr }))
                  .filter((pattern) => stateOf(pattern.distanceAtr) === 'breakout'),
          ].map((pattern) => ({ ...pattern, day: 2 as const }))
        : today;
    const ordered = _.sortBy(found, (pattern) => (pattern.state === 'breakout' ? 0 : 1) * 100 + PRIORITY.indexOf(pattern.kind));
    return _.uniqBy(ordered, 'kind');
};
