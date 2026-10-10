import 'dotenv/config';
import * as fs from 'fs';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import * as AlpacaAPI from '../app/proxy/alpaca-api';
import { RaceRulesConfig } from '../app/config/race-rules.config';

// Splits the upper-BB touch study (/tmp/bb-touch-events.json, from bb-touch-study.ts) by whether the stock was
// healthy with the hourly 20 SMA that morning: no pre-market hourly candle closed through it (the board's rule).
// usage: npx ts-node scripts/bb-touch-health.ts [last date YYYY-MM-DD]

const lastDate = process.argv[2] || '2026-10-09';
const NY = 'America/New_York';
const events: any[] = JSON.parse(fs.readFileSync('/tmp/bb-touch-events.json', 'utf8'));
const cacheFile = `/tmp/bb-touch-hourly-${lastDate}.json`;
const period = globalConfig.PremarketRace.smaPeriod;
const tolerance = RaceRulesConfig.smaTolerancePct;

type Hourly = { [symbol: string]: { t: string; close: number }[] };

const load = async (): Promise<Hourly> => {
    if (fs.existsSync(cacheFile)) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    const symbols = _.uniq(events.map((event) => event.quote));
    const end = moment.tz(lastDate, NY).add(1, 'day').format('YYYY-MM-DD');
    const hourly: Hourly = {};
    for (const chunk of _.chunk(symbols, 6)) {
        await Promise.all(
            chunk.map(async (symbol) => {
                try {
                    const history = await AlpacaAPI.getQuote24HourHourlyHistory(symbol, end, 380);
                    hourly[symbol] = history.candles.map((candle) => ({ t: moment(candle.datetime).tz(NY).format('YYYY-MM-DD HH:mm'), close: candle.close }));
                } catch (err) {
                    console.error(`skipping ${symbol}: ${err}`);
                }
            })
        );
        process.stdout.write('.');
    }
    fs.writeFileSync(cacheFile, JSON.stringify(hourly));
    return hourly;
};

// The first pre-market hourly candle of the day that closed more than the tolerance under the 20 SMA, or null.
const brokenHour = (candles: { t: string; close: number }[], date: string): string | null | undefined => {
    const first = candles.findIndex((candle) => candle.t >= `${date} 04:00`);
    if (first < period || !candles[first].t.startsWith(date)) {
        return undefined;
    }
    for (let i = first; i < candles.length && candles[i].t < `${date} 09:00`; i++) {
        const sma = _.mean(candles.slice(i - period + 1, i + 1).map((candle) => candle.close));
        if (((candles[i].close - sma) / sma) * 100 < -tolerance) {
            return candles[i].t.slice(11);
        }
    }
    return null;
};

const run = async () => {
    const hourly = await load();
    const tagged = events
        .filter((event) => event.meaningful && hourly[event.quote])
        .map((event) => ({ ...event, broken: brokenHour(hourly[event.quote], event.date) }))
        .filter((event) => event.broken !== undefined);

    const row = (label: string, list: any[]) => {
        const pct = (outcome: string) => ((100 * list.filter((event) => event.outcome === outcome).length) / (list.length || 1)).toFixed(0).padStart(3);
        console.log(`${label.padEnd(30)} ${String(list.length).padStart(4)}   up ${pct('up')}%  down ${pct('down')}%`);
    };
    console.log(`\n${tagged.length} meaningful touches tagged (of ${events.filter((event) => event.meaningful).length})\n`);
    for (const [name, filter] of [
        ['ALL', () => true],
        ['healthy', (event: any) => event.broken === null],
        ['not healthy', (event: any) => event.broken !== null],
    ] as [string, (event: any) => boolean][]) {
        const list = tagged.filter(filter);
        row(name, list);
        for (const verdict of ['fast', 'slow', 'heavy', 'opening', 'unclear']) {
            row(`   ${verdict}`, list.filter((event) => event.verdict === verdict));
        }
    }
    console.log('\nAFRM touches:');
    tagged
        .filter((event) => event.quote === 'AFRM')
        .forEach((event) =>
            console.log(`  ${event.date} +${event.minutesFromOpen}m ${event.verdict.padEnd(8)} ${event.broken === null ? 'healthy' : `broken ${event.broken}`} → ${event.outcome}`)
        );
};

run();
