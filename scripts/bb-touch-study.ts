import 'dotenv/config';
import * as fs from 'fs';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import * as AlpacaAPI from '../app/proxy/alpaca-api';
import { RaceRulesConfig } from '../app/config/race-rules.config';
import { averageTrueRangePct } from '../app/engine/race-rules/race-facts';
import { buildWatchFacts } from '../app/engine/market-watch/watch-facts';
import { findBandTouches, IBandTouch } from '../app/engine/market-watch/signals/upper-band-touch';
import { IQuoteIntervals } from '../app/models/quote-data.model';

// Calibrates the "upper BB touch" signal: every day a stock of the trading list opened above the daily upper band,
// find its touches and see what the price did in the next hour.
// usage: npx ts-node scripts/bb-touch-study.ts [last date YYYY-MM-DD] [calendar days back] [quotes: list name or tickers]
// Bars are cached in /tmp, so a second run only re-analyses.

const lastDate = process.argv[2] || '2026-10-09';
const daysBack = Number(process.argv[3] || 130);
const quotesArg = process.argv[4] || 'producion';
const TARGET_ATR = Number(process.argv[5] || 0.15); // first to move this far up or down from the touch wins
const HORIZON = Number(process.argv[6] || 12); // candles after the touch

const symbols: string[] = quotesArg.includes(',')
    ? quotesArg.toUpperCase().split(',')
    : _.flatMap(
          Object.entries((globalConfig.QuotesConfig as any)[quotesArg]).filter(([group]) => !globalConfig.PremarketRace.excludeGroups.includes(group)),
          ([, group]: [string, any]) => group.names.map((name: string) => name.toUpperCase())
      );
const cacheFile = `/tmp/bb-touch-study-${lastDate}-${daysBack}-${quotesArg.replace(/,/g, '_')}.json`;

interface IStudyData {
    daily: { [symbol: string]: { date: string; high: number; low: number; close: number; volume: number }[] };
    intraday: { [symbol: string]: IQuoteIntervals };
}

const load = async (): Promise<IStudyData> => {
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    const data: IStudyData = { daily: {}, intraday: {} };
    await Promise.all(
        symbols.map(async (symbol) => {
            try {
                const [daily, intraday] = await Promise.all([
                    AlpacaAPI.getQuoteFullYearDailyHistory(symbol),
                    AlpacaAPI.getQuote5MinuteMultipleDays(symbol, lastDate, daysBack, false),
                ]);
                data.daily[symbol] = daily.candles.map((candle) => ({
                    date: moment(candle.datetime).tz('America/Chicago').format('YYYY-MM-DD'),
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume,
                }));
                data.intraday[symbol] = _.mapValues(intraday, ({ open, high, low, close, volume }) => ({ open, high, low, close, volume })) as any;
            } catch (err) {
                console.error(`skipping ${symbol}: ${err}`);
            }
        })
    );
    fs.writeFileSync(cacheFile, JSON.stringify(data));
    return data;
};

interface IEvent extends IBandTouch {
    quote: string;
    date: string;
    touchNumber: number;
    minutesFromOpen: number;
    outcome: 'up' | 'down' | 'none';
    return6Atr: number | null;
    return12Atr: number | null;
    upAtr: number; // best price above the touch within the horizon
    downAtr: number; // worst price below it
}

const study = (data: IStudyData): { events: IEvent[]; aboveOpens: number; stockDays: number } => {
    const events: IEvent[] = [];
    let aboveOpens = 0;
    let stockDays = 0;
    for (const symbol of Object.keys(data.intraday)) {
        const daily = data.daily[symbol] || [];
        const byDate = _.groupBy(Object.keys(data.intraday[symbol]), (key) => key.substring(0, 10));
        for (const date of Object.keys(byDate).sort()) {
            const prior = daily.filter((candle) => candle.date < date);
            const averageVolume = _.meanBy(_.takeRight(prior, RaceRulesConfig.averageVolumeDays), 'volume') || 0;
            if (prior.length < 30 || averageVolume < RaceRulesConfig.minAverageDailyVolume) {
                continue;
            }
            stockDays++;
            const intervals = _.pick(data.intraday[symbol], byDate[date]);
            const facts = buildWatchFacts({
                quote: symbol,
                tradeDate: date,
                atrPct: averageTrueRangePct(prior, RaceRulesConfig.atrPeriodDays),
                priorDailyCloses: _.takeRight(prior, RaceRulesConfig.bollinger.periodDays).map((candle) => candle.close),
                intervals,
                sessionStart: '09:30',
                sessionEnd: '16:00',
                dataClock: moment.tz(`${date} 23:59`, 'YYYY-MM-DD HH:mm', 'America/New_York'),
            });
            const touches = findBandTouches(facts);
            if (facts.openingPrice !== null && facts.bars.length > 0 && (touches.length > 0 || isAboveAtOpen(facts))) {
                aboveOpens++;
            }
            touches.forEach((touch, touchIndex) => {
                const unit = (touch.level * facts.atrPct) / 100;
                const after = facts.bars.slice(touch.index + 1, touch.index + 1 + HORIZON);
                let outcome: IEvent['outcome'] = 'none';
                for (const bar of after) {
                    const up = bar.high >= touch.level + TARGET_ATR * unit;
                    const down = bar.low <= touch.level - TARGET_ATR * unit;
                    if (down) {
                        outcome = 'down'; // a candle hitting both counts against the bounce
                        break;
                    }
                    if (up) {
                        outcome = 'up';
                        break;
                    }
                }
                const returnAt = (candles: number) =>
                    after.length >= candles ? (after[candles - 1].close - touch.level) / unit : null;
                events.push({
                    ...touch,
                    quote: symbol,
                    date,
                    touchNumber: touchIndex + 1,
                    minutesFromOpen: touch.index * 5,
                    outcome,
                    return6Atr: returnAt(6),
                    return12Atr: returnAt(12),
                    upAtr: after.length ? Math.max(0, (_.maxBy(after, 'high')!.high - touch.level) / unit) : 0,
                    downAtr: after.length ? Math.max(0, (touch.level - _.minBy(after, 'low')!.low) / unit) : 0,
                });
            });
        }
    }
    return { events, aboveOpens, stockDays };
};

// Only for counting how often stocks open above the band.
const isAboveAtOpen = (facts: ReturnType<typeof buildWatchFacts>) => {
    const { periodDays, stdDevs } = RaceRulesConfig.bollinger;
    const closes = [..._.takeRight(facts.priorDailyCloses, periodDays - 1), facts.openingPrice as number];
    const mean = _.mean(closes);
    return (facts.openingPrice as number) > mean + stdDevs * Math.sqrt(_.meanBy(closes, (close) => (close - mean) ** 2));
};

const summary = (label: string, group: IEvent[]) => {
    if (group.length === 0) {
        return `${label.padEnd(34)}    0`;
    }
    const up = group.filter((event) => event.outcome === 'up').length;
    const down = group.filter((event) => event.outcome === 'down').length;
    const mean = (values: (number | null)[]) => {
        const known = values.filter((value): value is number => value !== null);
        return known.length ? _.mean(known) : NaN;
    };
    return (
        `${label.padEnd(34)} ${String(group.length).padStart(4)}   up first ${pct(up, group.length)}  down first ${pct(down, group.length)}` +
        `   up>down ${pct(group.filter((event) => event.upAtr > event.downAtr).length, group.length)}` +
        `  up ${fmt(_.meanBy(group, 'upAtr'))} down ${fmt(-_.meanBy(group, 'downAtr'))}` +
        `   +30m ${fmt(mean(group.map((event) => event.return6Atr)))}  +60m ${fmt(mean(group.map((event) => event.return12Atr)))}`
    );
};
const pct = (part: number, whole: number) => `${Math.round((100 * part) / whole)}%`.padStart(4);
const fmt = (value: number) => (Number.isNaN(value) ? '   – ' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`);

const bucket = (events: IEvent[], label: string, value: (event: IEvent) => number | null, edges: number[]) => {
    console.log(`\n${label}`);
    edges.forEach((edge, index) => {
        const next = edges[index + 1];
        const group = events.filter((event) => {
            const measured = value(event);
            return measured !== null && measured >= edge && (next === undefined || measured < next);
        });
        console.log(summary(`  ${edge}${next === undefined ? '+' : ` – ${next}`}`, group));
    });
};

const main = async () => {
    console.log(`Loading ${symbols.length} stocks, ${daysBack} calendar days to ${lastDate}…`);
    const data = await load();
    const { events, aboveOpens, stockDays } = study(data);
    const meaningful = events.filter((event) => event.meaningful);
    console.log(`\n${stockDays} stock-days, ${aboveOpens} opened above the upper BB, ${events.length} touches (${meaningful.length} after a real move away)`);
    console.log(`Outcome: first to move ${TARGET_ATR} ATR from the touch within ${HORIZON} candles.\n`);
    console.log(summary('All meaningful touches', meaningful));
    console.log(summary('Hugging touches (excluded)', events.filter((event) => !event.meaningful)));
    (['fast', 'slow', 'heavy', 'opening', 'unclear'] as const).forEach((verdict) => console.log(summary(`Verdict: ${verdict}`, meaningful.filter((event) => event.verdict === verdict))));

    bucket(meaningful, 'Drop over the last 4 candles (ATR)', (event) => event.recentDropAtr, [0, 0.1, 0.2, 0.3, 0.45, 0.7, 1]);
    bucket(meaningful, 'Share of the way down in the last 4 candles', (event) => event.recentShare, [0, 0.25, 0.5, 0.6, 0.75, 0.9]);
    bucket(meaningful, 'Descent length (candles since near the top)', (event) => event.descentCandles, [1, 3, 5, 8, 12, 20]);
    bucket(meaningful, 'Lower-high share of the descent', (event) => event.lowerHighShare, [0, 0.4, 0.6, 0.75, 0.9]);
    bucket(meaningful, 'Whole drop from the high (ATR)', (event) => event.dropAtr, [0.15, 0.3, 0.5, 0.8, 1.2]);
    bucket(meaningful, 'Volume on the approach vs median candle', (event) => event.volumeRatio, [0, 0.75, 1, 1.5, 2.5]);
    bucket(meaningful, 'Minutes from the open', (event) => event.minutesFromOpen, [0, 5, 15, 30, 60, 120, 240]);
    bucket(meaningful, 'Touch number that day', (event) => event.touchNumber, [1, 2, 3]);

    console.log('\nGrid: recent drop (rows, ATR) × descent length (columns, candles) — "up first" rate and count');
    const dropEdges = [0, 0.15, 0.3, 0.5, 0.8];
    const lengthEdges = [1, 3, 5, 8, 13];
    console.log('            ' + lengthEdges.map((edge, index) => `${edge}${lengthEdges[index + 1] ? `-${lengthEdges[index + 1] - 1}` : '+'}`.padStart(12)).join(''));
    dropEdges.forEach((edge, index) => {
        const next = dropEdges[index + 1];
        const row = meaningful.filter((event) => event.recentDropAtr >= edge && (next === undefined || event.recentDropAtr < next));
        const cells = lengthEdges.map((lengthEdge, lengthIndex) => {
            const lengthNext = lengthEdges[lengthIndex + 1];
            const cell = row.filter((event) => event.descentCandles >= lengthEdge && (lengthNext === undefined || event.descentCandles < lengthNext));
            return (cell.length ? `${pct(cell.filter((event) => event.outcome === 'up').length, cell.length)} (${cell.length})` : '–').padStart(12);
        });
        console.log(`${`${edge}${next === undefined ? '+' : `-${next}`}`.padEnd(12)}${cells.join('')}`);
    });

    fs.writeFileSync('/tmp/bb-touch-events.json', JSON.stringify(meaningful.map((event) => _.omit(event, 'bar'))));
    console.log('\nEvents written to /tmp/bb-touch-events.json');
};

main().then(() => process.exit(0));
