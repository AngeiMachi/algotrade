import 'dotenv/config';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import { MarketWatchConfig } from '../app/config/market-watch.config';
import { RaceRulesConfig } from '../app/config/race-rules.config';
import * as AlpacaAPI from '../app/proxy/alpaca-api';
import { averageTrueRangePct } from '../app/engine/race-rules/race-facts';
import { relativeVolumeAt } from '../app/engine/market-watch/alert-score';
import { buildWatchFacts } from '../app/engine/market-watch/watch-facts';
import { shine } from '../app/engine/market-watch/signals/shine';

// What the Shine alerts of one day did next, and what the stocks looked like at the alert.
// usage: npx ts-node scripts/shine-study.ts <date> <quotes: list name or tickers>
// Outcomes in daily ATRs from the alert candle's close: best rise in the next hour, worst dip before it, and the
// price at 11:30, 13:00 and the close.

const date = process.argv[2] || '2026-10-23';
const quotesArg = process.argv[3] || 'producion';
const NY = 'America/New_York';

const symbols: string[] = quotesArg.includes(',')
    ? quotesArg.toUpperCase().split(',')
    : _.flatMap(
          Object.entries((globalConfig.QuotesConfig as any)[quotesArg]).filter(([group]) => !globalConfig.PremarketRace.excludeGroups.includes(group)),
          ([, group]: [string, any]) => group.names.map((name: string) => name.toUpperCase())
      );

const run = async () => {
    // RAW=1: without the volume, tight and slow filters, to see what they took out.
    if (process.env.RAW) {
        Object.assign(MarketWatchConfig.shine, { minCandleVolume: 0, maxDipAtr: Infinity, maxTriggerRangeAtr: Infinity });
    }
    globalConfig.Mock.IsMock = true;
    globalConfig.Mock.MockDataDate = date;
    const { priorCloses, priorCalendarDays, slowSmaPeriod } = MarketWatchConfig.shine;
    const rows: any[] = [];
    await Promise.all(
        _.uniq(symbols).map(async (quote) => {
            try {
                const [daily, intervals, volumeHistory, priorHistory, hourly] = await Promise.all([
                    AlpacaAPI.getQuoteFullYearDailyHistory(quote),
                    AlpacaAPI.getQuote5MinuteMultipleDays(quote, date, 0, true),
                    AlpacaAPI.getPremarketVolumeHistory(quote, date, RaceRulesConfig.relativeVolume.days),
                    AlpacaAPI.getPrior5MinuteCloses(quote, date, priorCloses, priorCalendarDays),
                    AlpacaAPI.getQuote24HourHourlyHistory(quote, date),
                ]);
                const prior = priorHistory.closes;
                const history = daily.candles.filter((candle) => moment(candle.datetime).tz(NY).format('YYYY-MM-DD') < date);
                const priorDailyCloses = history.map((candle) => candle.close);
                const atrPct = averageTrueRangePct(history, RaceRulesConfig.atrPeriodDays);
                const facts = buildWatchFacts({
                    quote,
                    tradeDate: date,
                    atrPct,
                    priorDailyCloses,
                    volumeHistory,
                    intervals,
                    sessionStart: '09:30',
                    sessionEnd: '16:00',
                    dataClock: moment.tz(`${date} 16:00`, 'YYYY-MM-DD HH:mm', NY),
                    shineOn: true,
                    prior5MinCloses: priorHistory,
                    priorHourlyCloses: hourly.candles.map((candle) => candle.close),
                });
                const alert = shine.detect(facts)[0];
                if (!alert) {
                    if (process.env.WHY) {
                        const status = shine.status(facts);
                        console.log(`${quote}: ${status ? `${status.state}, ${status.note}` : 'never lost the 200 SMA'}`);
                    }
                    return;
                }
                const price = alert.price;
                const atr = (atrPct / 100) * price;
                const inAtr = (value: number) => value / atr;
                const after = facts.bars.filter((bar) => bar.time >= alert.candle);
                const hour = after.slice(0, 12);
                const at = (time: string) => _.findLast(facts.bars, (bar) => bar.time < time)?.close ?? price;
                const sinceBell = facts.bars.filter((bar) => bar.time < alert.candle);
                const triggerBar = _.last(sinceBell)!;
                const closes = [...prior, ...facts.allBars.map((bar) => bar.close)];
                const index = prior.length + facts.allBars.indexOf(triggerBar);
                const sma = (period: number, end: number) => _.mean(closes.slice(end - period + 1, end + 1));
                const slow = sma(slowSmaPeriod, index);
                const previousClose = _.last(priorDailyCloses)!;
                const sma20d = _.mean(_.takeRight(priorDailyCloses, 20));
                const sma50d = _.mean(_.takeRight(priorDailyCloses, 50));
                // The hourly 20 SMA hour by hour up to the alert's hour (its close = the alert candle's close).
                const alertHour = triggerBar.time.substring(0, 2);
                const hourlyCloses = [
                    ...facts.priorHourlyCloses,
                    ...facts.hours.filter((candle) => candle.hour < alertHour).map((candle) => candle.close),
                    triggerBar.close,
                ];
                const h20 = _.range(30, -1, -1).map((back) => _.mean(hourlyCloses.slice(hourlyCloses.length - back - 20, hourlyCloses.length - back)));
                const steps = h20.slice(1).map((value, i) => value - h20[i]);
                let fallRun = 0;
                while (fallRun < steps.length && steps[steps.length - 1 - fallRun] < 0) {
                    fallRun++;
                }
                const premarketLast = _.findLast(facts.allBars, (bar) => bar.time < '09:30')?.close ?? facts.openingPrice!;
                rows.push({
                    quote,
                    candle: triggerBar.time,
                    up1h: inAtr(_.max(hour.map((bar) => bar.high))! - price),
                    dip1h: inAtr(_.min(hour.map((bar) => bar.low))! - price),
                    at1130: inAtr(at('11:30') - price),
                    at1300: inAtr(at('13:00') - price),
                    atClose: inAtr(at('16:00') - price),
                    gap: inAtr(facts.openingPrice! - previousClose),
                    pre: inAtr(premarketLast - previousClose),
                    day: inAtr(price - previousClose),
                    fromOpen: inAtr(price - facts.openingPrice!),
                    dipUnder: inAtr(slow - _.min(sinceBell.map((bar) => bar.low))!),
                    overSlow: inAtr(price - slow),
                    slope200: inAtr(slow - sma(slowSmaPeriod, index - 12)),
                    candleBody: inAtr(triggerBar.close - triggerBar.open),
                    sessRange: inAtr(_.max(sinceBell.map((bar) => bar.high))! - _.min(sinceBell.map((bar) => bar.low))!),
                    maxCandle: inAtr(_.max(sinceBell.map((bar) => bar.high - bar.low))!),
                    first15: inAtr(_.max(sinceBell.slice(0, 3).map((bar) => bar.high))! - _.min(sinceBell.slice(0, 3).map((bar) => bar.low))!),
                    trigRange: inAtr(triggerBar.high - triggerBar.low),
                    last3Range: inAtr(_.max(sinceBell.slice(-3).map((bar) => bar.high))! - _.min(sinceBell.slice(-3).map((bar) => bar.low))!),
                    lossAtr: inAtr(
                        Math.max(
                            sma(slowSmaPeriod, prior.length + facts.allBars.indexOf(sinceBell[0]) - 1) - facts.openingPrice!,
                            ..._.dropRight(sinceBell, 1).map((bar) => sma(slowSmaPeriod, prior.length + facts.allBars.indexOf(bar)) - bar.close)
                        )
                    ),
                    awayMax: inAtr(_.max(sinceBell.map((bar) => Math.abs(bar.close - sma(slowSmaPeriod, prior.length + facts.allBars.indexOf(bar)))))!),
                    closeInRange: (triggerBar.close - triggerBar.low) / Math.max(triggerBar.high - triggerBar.low, 1e-9),
                    candleVol: alert.candleVolumeRatio ?? null,
                    rvol: relativeVolumeAt(facts, triggerBar.time),
                    vs20d: inAtr(previousClose - sma20d),
                    vs50d: inAtr(previousClose - sma50d),
                    atrPct,
                    h20d10: inAtr(_.last(h20)! - h20[h20.length - 11]),
                    h20d20: inAtr(_.last(h20)! - h20[h20.length - 21]),
                    h20run: fallRun,
                    h20down15: steps.slice(-15).filter((step) => step < 0).length,
                    h20worst5: inAtr(_.min(_.range(5, 21).map((i) => h20[h20.length - 1 - i + 5] - h20[h20.length - 1 - i]))!),
                    opened: alert.message.includes('opened'),
                });
            } catch (err) {
                console.error(`skipping ${quote}: ${err}`);
            }
        })
    );
    const sorted = _.orderBy(rows, ['up1h'], ['desc']);
    const columns = Object.keys(sorted[0] || {}).filter((key) => key !== 'quote' && key !== 'candle');
    const cell = (value: any) => (typeof value === 'number' ? value.toFixed(2) : String(value)).padStart(7);
    console.log(`${'quote'.padEnd(6)} ${'candle'.padEnd(6)} ${columns.map((key) => key.padStart(7)).join(' ')}`);
    sorted.forEach((row) => console.log(`${row.quote.padEnd(6)} ${row.candle.padEnd(6)} ${columns.map((key) => cell(row[key])).join(' ')}`));
    // Which measurements at the alert go with a better next hour: rank correlation with up1h.
    const rank = (values: number[]) => {
        const order = _.sortBy(values.map((value, i) => ({ value, i })), 'value');
        const ranks: number[] = [];
        order.forEach(({ i }, position) => (ranks[i] = position));
        return ranks;
    };
    const spearman = (a: number[], b: number[]) => {
        const ra = rank(a);
        const rb = rank(b);
        const ma = _.mean(ra);
        const mb = _.mean(rb);
        const cov = _.sum(ra.map((x, i) => (x - ma) * (rb[i] - mb)));
        return cov / Math.sqrt(_.sum(ra.map((x) => (x - ma) ** 2)) * _.sum(rb.map((x) => (x - mb) ** 2)));
    };
    console.log(`\n${rows.length} alerts. Rank correlation with the next hour's best rise (up1h) and with the close (atClose):`);
    columns
        .filter((key) => !['up1h', 'dip1h', 'at1130', 'at1300', 'atClose', 'opened'].includes(key))
        .forEach((key) => {
            const valid = rows.filter((row) => typeof row[key] === 'number');
            console.log(
                `  ${key.padEnd(12)} ${spearman(valid.map((row) => row[key]), valid.map((row) => row.up1h)).toFixed(2).padStart(6)} ${spearman(
                    valid.map((row) => row[key]),
                    valid.map((row) => row.atClose)
                )
                    .toFixed(2)
                    .padStart(6)}`
            );
        });
};

run().catch((err) => {
    console.error('STUDY FAILED', err);
    process.exit(1);
});
