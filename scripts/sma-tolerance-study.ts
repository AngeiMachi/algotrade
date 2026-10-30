import 'dotenv/config';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import { RaceRulesConfig } from '../app/config/race-rules.config';
import * as AlpacaAPI from '../app/proxy/alpaca-api';
import { averageTrueRangePct } from '../app/engine/race-rules/race-facts';
import { buildWatchFacts } from '../app/engine/market-watch/watch-facts';
import { smaAtHour } from '../app/engine/market-watch/hourly-sma';

// How deep the pre-market hourly closes under the 20 SMA went, and what the stock did after the bell: is a close a few
// cents under a real break? Per stock and day, the deepest of the judged pre-market hours (the race's
// hourlyCloseLookbackHours before the bell, with trades), in % and in daily ATRs.
// usage: npx ts-node scripts/sma-tolerance-study.ts <date,date,...> [list]
// Outcomes from the open, in daily ATRs: at 11:00 and at the close; and whether the 10:00 hourly candle closed above
// the 20 SMA.

const NY = 'America/New_York';
const dates = (process.argv[2] || '2026-10-29').split(',');
const listName = process.argv[3] || 'producion';
const symbols: string[] = _.uniq(
    _.flatMap(
        Object.entries((globalConfig.QuotesConfig as any)[listName]).filter(([group]) => !globalConfig.PremarketRace.excludeGroups.includes(group)),
        ([, group]: [string, any]) => group.names.map((name: string) => name.toUpperCase())
    )
);
const period = globalConfig.PremarketRace.smaPeriod;

interface IRow {
    date: string;
    quote: string;
    worstPct: number; // deepest judged close vs the SMA, % (negative = under)
    worstAtr: number;
    worstHour: string;
    worstVolume: number;
    at1100: number;
    atClose: number;
    tenAbove: boolean;
}

const at = (facts: ReturnType<typeof buildWatchFacts>, time: string) => _.findLast(facts.bars, (bar) => bar.time < time)?.close;

const run = async () => {
    globalConfig.Mock.IsMock = true;
    globalConfig.Mock.MockDataDate = _.last(dates)!;
    const daily: { [quote: string]: any[] } = {};
    await Promise.all(symbols.map(async (quote) => (daily[quote] = (await AlpacaAPI.getQuoteFullYearDailyHistory(quote).catch(() => ({ candles: [] }))).candles)));
    const rows: IRow[] = [];
    for (const date of dates) {
        globalConfig.Mock.MockDataDate = date;
        await Promise.all(
            symbols.map(async (quote) => {
                try {
                    const [intervals, hourly] = await Promise.all([
                        AlpacaAPI.getQuote5MinuteMultipleDays(quote, date, 0, true),
                        AlpacaAPI.getQuote24HourHourlyHistory(quote, date),
                    ]);
                    const history = daily[quote].filter((candle) => moment(candle.datetime).tz(NY).format('YYYY-MM-DD') < date);
                    const atrPct = averageTrueRangePct(history, RaceRulesConfig.atrPeriodDays);
                    const facts = buildWatchFacts({
                        quote,
                        tradeDate: date,
                        atrPct,
                        priorDailyCloses: history.map((candle) => candle.close),
                        priorHourlyCloses: hourly.candles.map((candle) => candle.close),
                        intervals,
                        sessionStart: '09:30',
                        sessionEnd: '16:00',
                        dataClock: moment.tz(`${date} 16:00`, 'YYYY-MM-DD HH:mm', NY),
                    });
                    if (facts.openingPrice === null || atrPct <= 0 || facts.priorHourlyCloses.length < period) {
                        return;
                    }
                    const judged = facts.hours.filter((hour) => hour.hour < '09' && Number(hour.hour) >= 9 - RaceRulesConfig.hourlyCloseLookbackHours && hour.traded);
                    if (judged.length === 0) {
                        return;
                    }
                    const readings = judged.map((hour) => {
                        const sma = smaAtHour(facts, period, hour.hour, hour.close)!;
                        const pct = ((hour.close - sma) / sma) * 100;
                        const volume = _.sumBy(facts.allBars.filter((bar) => bar.time.startsWith(`${hour.hour}:`)), 'volume');
                        return { hour: hour.hour, pct, atr: pct / atrPct, volume };
                    });
                    const worst = _.minBy(readings, 'pct')!;
                    const ten = facts.hours.find((hour) => hour.hour === '10');
                    const tenSma = ten ? smaAtHour(facts, period, '10', ten.close) : null;
                    const atr = (atrPct / 100) * facts.openingPrice;
                    rows.push({
                        date,
                        quote,
                        worstPct: worst.pct,
                        worstAtr: worst.atr,
                        worstHour: worst.hour,
                        worstVolume: worst.volume,
                        at1100: ((at(facts, '11:00') ?? facts.openingPrice) - facts.openingPrice) / atr,
                        atClose: ((at(facts, '16:00') ?? facts.openingPrice) - facts.openingPrice) / atr,
                        tenAbove: !!ten && tenSma !== null && ten.close > tenSma,
                    });
                } catch (err) {
                    console.error(`skipping ${quote} ${date}: ${err}`);
                }
            })
        );
        console.error(`${date} done, ${rows.length} rows`);
    }

    // Bins by how deep the deepest judged close went under the SMA, in daily ATRs.
    const bins: [string, (row: IRow) => boolean][] = [
        ['held (≥ −0.05%)', (row) => row.worstPct >= -RaceRulesConfig.smaTolerancePct],
        ['out now, < 0.03 ATR', (row) => row.worstPct < -RaceRulesConfig.smaTolerancePct && row.worstAtr >= -0.03],
        ['0.03–0.06 ATR', (row) => row.worstAtr < -0.03 && row.worstAtr >= -0.06],
        ['0.06–0.10 ATR', (row) => row.worstAtr < -0.06 && row.worstAtr >= -0.1],
        ['0.10–0.20 ATR', (row) => row.worstAtr < -0.1 && row.worstAtr >= -0.2],
        ['> 0.20 ATR', (row) => row.worstAtr < -0.2],
    ];
    console.log(`\n${rows.length} stock-days, ${dates.join(', ')}`);
    console.log(`${'deepest judged close under'.padEnd(26)} ${'n'.padStart(4)} ${'at 11:00'.padStart(9)} ${'close'.padStart(7)} ${'up at close'.padStart(12)} ${'10:00 above'.padStart(12)}`);
    bins.forEach(([label, test]) => {
        const group = rows.filter(test);
        if (group.length === 0) {
            return;
        }
        const share = (predicate: (row: IRow) => boolean) => `${Math.round((group.filter(predicate).length / group.length) * 100)}%`;
        console.log(
            `${label.padEnd(26)} ${String(group.length).padStart(4)} ${_.mean(group.map((row) => row.at1100)).toFixed(2).padStart(9)} ${_.mean(group.map((row) => row.atClose))
                .toFixed(2)
                .padStart(7)} ${share((row) => row.atClose > 0).padStart(12)} ${share((row) => row.tenAbove).padStart(12)}`
        );
    });
    if (process.env.LIST) {
        _.sortBy(rows.filter((row) => row.worstPct < -RaceRulesConfig.smaTolerancePct && row.worstAtr >= -0.1), 'worstAtr').forEach((row) =>
            console.log(
                `  ${row.date} ${row.quote.padEnd(6)} ${row.worstHour}:00 ${row.worstPct.toFixed(2)}% = ${row.worstAtr.toFixed(3)} ATR on ${row.worstVolume.toLocaleString()} shares → 11:00 ${row.at1100.toFixed(2)}, close ${row.atClose.toFixed(2)}`
            )
        );
    }
};

run().catch((err) => {
    console.error('STUDY FAILED', err);
    process.exit(1);
});
