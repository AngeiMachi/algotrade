import 'dotenv/config';
import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../app/config/globals.config';
import * as AlpacaAPI from '../app/proxy/alpaca-api';
import * as convertUtils from '../app/utils/convert-utils';
import * as quoteUtils from '../app/utils/quote-utils';

const TRADE_DATE = process.argv[2] || '2026-10-08';
const LIQUID = ['SPY', 'AAPL', 'NVDA', 'TSLA', 'AMD', 'META'];
const THIN = ['HUT', 'NNOX', 'PTGX', 'AEHR', 'FOLD', 'SSYS', 'PAGS', 'FVRR', 'ASAN', 'LMND'];

const run = async () => {
    globalConfig.Mock.IsMock = true;
    globalConfig.Mock.MockDataDate = TRADE_DATE;

    console.log(`\n=== Market hours ${TRADE_DATE} ===`);
    console.log(JSON.stringify(convertUtils.convertAlpacaMarketHours(await AlpacaAPI.getMarketHours(TRADE_DATE), TRADE_DATE)));
    const holiday = '2026-11-26';
    try {
        convertUtils.convertAlpacaMarketHours(await AlpacaAPI.getMarketHours(holiday), holiday);
    } catch (err) {
        console.log(`holiday ${holiday}: ${err}`);
    }

    console.log(`\n=== History / metadata (as of ${TRADE_DATE}) ===`);
    const [daily, weekly, hourly] = await Promise.all([
        AlpacaAPI.getQuoteFullYearDailyHistory('AAPL'),
        AlpacaAPI.getQuoteFullYearWeeklyHistory('AAPL'),
        AlpacaAPI.getQuoteHourlyHistory('AAPL'),
    ]);
    const fmt = (ms: number) => moment(ms).tz('America/New_York').format('YYYY-MM-DD HH:mm');
    console.log(`daily: ${daily.candles.length} candles ${fmt(daily.candles[0].datetime)} -> ${fmt(_.last(daily.candles)!.datetime)}`);
    console.log(`weekly: ${weekly.candles.length} candles, last ${fmt(_.last(weekly.candles)!.datetime)}`);
    console.log(`hourly: ${hourly.candles.length} candles ${fmt(hourly.candles[0].datetime)} -> ${fmt(_.last(hourly.candles)!.datetime)}`);

    const metadata = quoteUtils.composeMetadata(TRADE_DATE, {
        quoteFullYearDailyHistory: daily,
        quoteFullYearWeeklyHistory: weekly,
        quoteHourlyHistory: hourly,
    });
    console.log('previousDay:', JSON.stringify(_.pick(metadata.previousDay, ['open', 'close', 'volume', 'timeNewYork'])));
    console.log('previousWeek:', JSON.stringify(_.pick(metadata.previousWeek, ['open', 'close', 'timeNewYork'])));
    console.log(
        `avgVol10d=${Math.round(metadata.averageDailyVolume10Day as number)} avgVol3m=${Math.round(metadata.averageDailyVolume3Month as number)} ` +
            `SMA20=${metadata.SMA20.previousDay.toFixed(2)} SMA200=${metadata.SMA200.previousDay.toFixed(2)} 52wH=${metadata.fiftyTwoWeekHigh} 52wL=${metadata.fiftyTwoWeekLow}`
    );

    console.log(`\n=== Live path: clock frozen at ${TRADE_DATE} 15:00 NY (IEX for the last ~16 min, scaled) ===`);
    const symbols = [...LIQUID, ...THIN];
    const frozenNow = moment.tz(`${TRADE_DATE} 15:00`, 'America/New_York').valueOf();
    const realNow = moment.now;

    (moment as any).now = () => frozenNow;
    const live = await Promise.all(symbols.map((s) => AlpacaAPI.getQuote5MinuteIntraday(s, TRADE_DATE)));
    (moment as any).now = realNow;
    const actual = await Promise.all(symbols.map((s) => AlpacaAPI.getQuote5MinuteMultipleDays(s, TRADE_DATE, 0)));

    symbols.forEach((symbol, i) => {
        const liveKeys = Object.keys(live[i]).filter((k) => k >= `${TRADE_DATE} 14:45:00` && k < `${TRADE_DATE} 15:00:00`);
        const expectedKeys = Object.keys(actual[i]).filter((k) => k >= `${TRADE_DATE} 14:45:00` && k < `${TRADE_DATE} 15:00:00`);
        const rows = liveKeys.map((k) => {
            const est = live[i][k];
            const real = actual[i][k];
            return `${k.substring(11, 16)} est=${est.volume} real=${real?.volume} (${real ? ((est.volume / real.volume) * 100).toFixed(0) : '-'}%) close ${est.close}/${real?.close}`;
        });
        const zeroOrMissing = expectedKeys.filter((k) => !live[i][k]).length;
        console.log(`${symbol.padEnd(5)} bars=${Object.keys(live[i]).length} missing-live=${zeroOrMissing}/${expectedKeys.length} | ${rows.join(' | ')}`);
    });
};

run().catch((err) => {
    console.error('VERIFY FAILED', err);
    process.exit(1);
});
