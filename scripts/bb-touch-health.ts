import 'dotenv/config';
import * as fs from 'fs';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import { RaceRulesConfig } from '../app/config/race-rules.config';
import { averageTrueRangePct } from '../app/engine/race-rules/race-facts';
import { buildWatchFacts } from '../app/engine/market-watch/watch-facts';
import { findBandTouches, judge } from '../app/engine/market-watch/signals/upper-band-touch';

// Trades every upper-BB touch the way the trader does, split by how healthy the stock was with the hourly SMAs.
// Bounce = halfway back to the high it fell from (at least +0.3 ATR) within 2 hours. Bail out on a 5-minute close
// 0.15 ATR under the band. Once it has bounced 0.15 ATR, a return to the buy price is a break-even exit.
// Two entries: at the touch, or on the first 5-minute close back above the band within 30 minutes.
// Needs the bb-touch-study cache and /tmp/bb-touch-hourly-30.json (24-hour hourly closes).
// usage: npx ts-node scripts/bb-touch-health.ts

const STUDY_CACHE = '/tmp/bb-touch-study-2026-10-09-345-producion.json';
const HOURLY_CACHE = '/tmp/bb-touch-hourly-30.json';
const HORIZON = 24;
const CONFIRM_WITHIN = 6;
const TARGET_MIN_ATR = 0.3;
const STOP_ATR = 0.15;
const BREAKEVEN_AFTER_ATR = 0.15;
const NY = 'America/New_York';

const study = JSON.parse(fs.readFileSync(STUDY_CACHE, 'utf8'));
const hourly: { [symbol: string]: { t: string; close: number }[] } = JSON.parse(fs.readFileSync(HOURLY_CACHE, 'utf8'));
const tolerance = RaceRulesConfig.smaTolerancePct;

const smaAt = (closes: number[], period: number) => (closes.length >= period ? _.mean(_.takeRight(closes, period)) : null);

// Healthy before the bell: no pre-market hourly candle (04:00–08:00) closed more than the tolerance under the SMA.
const healthyPremarket = (candles: { t: string; close: number }[], date: string, period: number): boolean | null => {
    const first = candles.findIndex((candle) => candle.t >= `${date} 04:00`);
    if (first < period || !candles[first].t.startsWith(date)) {
        return null;
    }
    for (let i = first; i < candles.length && candles[i].t < `${date} 09:00`; i++) {
        const sma = smaAt(candles.slice(0, i + 1).map((candle) => candle.close), period) as number;
        if (((candles[i].close - sma) / sma) * 100 < -tolerance) {
            return false;
        }
    }
    return true;
};

// Above the hourly SMA at the touch: completed hourly closes before the touch, with the touch price as the current one.
const aboveAtTouch = (candles: { t: string; close: number }[], touchTime: moment.Moment, price: number, period: number) => {
    const completed = candles.filter((candle) => moment.tz(candle.t, 'YYYY-MM-DD HH:mm', NY).add(1, 'hour').isSameOrBefore(touchTime));
    const sma = smaAt([...completed.map((candle) => candle.close), price], period);
    return sma === null ? null : price > sma;
};

type Result = 'win' | 'breakeven' | 'loss' | 'timeout' | 'skipped';

const trade = (bars: any[], from: number, entry: number, target: number, stop: number, unit: number): { result: Result; atr: number } => {
    let armed = false;
    const last = Math.min(bars.length - 1, from + HORIZON);
    for (let i = from; i <= last; i++) {
        const bar = bars[i];
        if (armed && bar.low <= entry) {
            return { result: 'breakeven', atr: 0 };
        }
        if (bar.close < stop) {
            return { result: 'loss', atr: (bar.close - entry) / unit };
        }
        if (bar.high >= target) {
            return { result: 'win', atr: (target - entry) / unit };
        }
        armed = armed || bar.high >= entry + BREAKEVEN_AFTER_ATR * unit;
    }
    return { result: 'timeout', atr: (bars[last].close - entry) / unit };
};

interface IRow {
    quote: string;
    date: string;
    time: string;
    verdict: string;
    h20: boolean | null;
    h50: boolean | null;
    above20: boolean | null;
    above50: boolean | null;
    atTouch: { result: Result; atr: number };
    confirmed: { result: Result; atr: number };
}

const rows: IRow[] = [];
for (const symbol of Object.keys(hourly)) {
    const daily = study.daily[symbol] || [];
    const byDate = _.groupBy(Object.keys(study.intraday[symbol] || {}), (key) => key.substring(0, 10));
    for (const date of Object.keys(byDate).sort()) {
        const prior = daily.filter((candle: any) => candle.date < date);
        const averageVolume = _.meanBy(_.takeRight(prior, RaceRulesConfig.averageVolumeDays), 'volume') || 0;
        if (prior.length < 30 || averageVolume < RaceRulesConfig.minAverageDailyVolume) {
            continue;
        }
        const facts = buildWatchFacts({
            quote: symbol,
            tradeDate: date,
            atrPct: averageTrueRangePct(prior, RaceRulesConfig.atrPeriodDays),
            priorDailyCloses: _.takeRight(prior, RaceRulesConfig.bollinger.periodDays).map((candle: any) => candle.close),
            intervals: _.pick(study.intraday[symbol], byDate[date]),
            sessionStart: '09:30',
            sessionEnd: '16:00',
            dataClock: moment.tz(`${date} 23:59`, 'YYYY-MM-DD HH:mm', NY),
        });
        for (const touch of findBandTouches(facts).filter((candidate) => candidate.meaningful)) {
            const bars = facts.bars;
            const unit = (touch.level * facts.atrPct) / 100;
            const target = Math.max(touch.level + 0.5 * (touch.top - touch.level), touch.level + TARGET_MIN_ATR * unit);
            const stop = touch.level - STOP_ATR * unit;
            const touchTime = moment.tz(`${date} 09:30`, 'YYYY-MM-DD HH:mm', NY).add(touch.index * 5, 'minutes');

            let confirmed: IRow['confirmed'] = { result: 'skipped', atr: 0 };
            for (let i = touch.index; i <= Math.min(bars.length - 1, touch.index + CONFIRM_WITHIN); i++) {
                if (bars[i].close < stop) {
                    break;
                }
                if (i > touch.index && bars[i].close > touch.level) {
                    const entry = bars[i].close;
                    confirmed = trade(bars, i + 1, entry, Math.max(target, entry + TARGET_MIN_ATR * unit), stop, unit);
                    break;
                }
            }
            rows.push({
                quote: symbol,
                date,
                time: touchTime.format('HH:mm'),
                verdict: judge(touch),
                h20: healthyPremarket(hourly[symbol], date, globalConfig.PremarketRace.smaPeriod),
                h50: healthyPremarket(hourly[symbol], date, 50),
                above20: aboveAtTouch(hourly[symbol], touchTime, touch.level, globalConfig.PremarketRace.smaPeriod),
                above50: aboveAtTouch(hourly[symbol], touchTime, touch.level, 50),
                atTouch: trade(bars, touch.index + 1, touch.level, target, stop, unit),
                confirmed,
            });
        }
    }
}

const pct = (list: { result: Result }[], result: Result) => `${((100 * list.filter((item) => item.result === result).length) / (list.length || 1)).toFixed(0)}%`.padStart(4);
const line = (label: string, group: IRow[]) => {
    const show = (trades: { result: Result; atr: number }[]) => {
        const taken = trades.filter((item) => item.result !== 'skipped');
        return `${String(taken.length).padStart(3)}  win ${pct(taken, 'win')} be ${pct(taken, 'breakeven')} loss ${pct(taken, 'loss')} time ${pct(taken, 'timeout')}  avg ${(_.meanBy(taken, 'atr') || 0).toFixed(2).padStart(5)}`;
    };
    console.log(`${label.padEnd(34)} ${String(group.length).padStart(3)} │ ${show(group.map((row) => row.atTouch))} │ ${show(group.map((row) => row.confirmed))}`);
};

console.log(`\n${rows.length} touches on ${Object.keys(hourly).length} stocks. avg = average result in daily ATRs per trade\n`);
console.log(`${''.padEnd(34)}   n │ buy at the touch                                   │ buy on a close back above the band`);
const groups: [string, (row: IRow) => boolean][] = [
    ['ALL', () => true],
    ['healthy 20 SMA pre-market', (row) => row.h20 === true],
    ['broke 20, healthy 50 pre-market', (row) => row.h20 === false && row.h50 === true],
    ['broke both pre-market', (row) => row.h20 === false && row.h50 === false],
    ['at touch: above 20 SMA', (row) => row.above20 === true],
    ['at touch: under 20, above 50', (row) => row.above20 === false && row.above50 === true],
    ['at touch: under 50 SMA', (row) => row.above50 === false],
];
for (const [label, filter] of groups) {
    line(label, rows.filter(filter));
}
console.log('\nby verdict');
for (const verdict of ['fast', 'slow', 'heavy', 'opening', 'unclear']) {
    line(`  ${verdict}`, rows.filter((row) => row.verdict === verdict));
    line(`  ${verdict} + above 50 at touch`, rows.filter((row) => row.verdict === verdict && row.above50 === true));
}
fs.writeFileSync('/tmp/bb-touch-trades.json', JSON.stringify(rows, null, 1));
