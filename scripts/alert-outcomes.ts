import 'dotenv/config';
import * as _ from 'lodash';
import moment from 'moment-timezone';
import * as AlpacaAPI from '../app/proxy/alpaca-api';

// How each buy setup of a replay played out over the next 2 hours. Run while the replay engine is up.
// usage: npx ts-node scripts/alert-outcomes.ts [YYYY-MM-DD, the replay day]
const date = process.argv[2] || '2026-10-09';
(async () => {
    const state = await (await fetch('http://localhost:11111/market-watch')).json();
    const buys = state.alerts.filter((a: any) => a.tone === 'opportunity');
    const rows: string[] = [];
    for (const alert of _.sortBy(buys, 'timeIso')) {
        const intervals = await AlpacaAPI.getQuote5MinuteIntraday(alert.quote, date, false);
        const at = moment(alert.timeIso).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
        const after = Object.keys(intervals).sort().filter((k) => k.startsWith(date) && k >= at && k.substring(11) < '16:00:00');
        const next2h = after.slice(0, 24).map((k) => intervals[k]);
        const wrongAt = Number((alert.summary.match(/Below ([\d.]+)|under ([\d.]+)/) || []).slice(1).find(Boolean));
        const firstBreak = next2h.findIndex((bar) => bar.low < wrongAt);
        const best = _.maxBy(next2h, 'high')!.high;
        const at2h = _.last(next2h)!.close;
        const dayClose = intervals[_.last(after)!].close;
        const pct = (p: number) => `${(((p - alert.price) / alert.price) * 100).toFixed(1)}%`.padStart(6);
        rows.push(
            `${alert.candle} ${alert.quote.padEnd(5)} ${alert.signal === 'sma-reclaim' ? 'reclaim' : 'BB held'} at ${alert.price.toFixed(2).padStart(8)}  best ${pct(best)}  2h ${pct(at2h)}  close ${pct(dayClose)}  ${firstBreak < 0 ? 'held its low' : `broke ${wrongAt} after ${(firstBreak + 1) * 5} min`}`
        );
    }
    console.log(rows.join('\n'));
})();
