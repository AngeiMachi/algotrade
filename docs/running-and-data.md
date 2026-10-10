# Running the app, the simulation, and market data

## Setup

- Alpaca keys go in `.env` (gitignored): `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`. Never commit or print them.
- Backend: `npm run dev` (nodemon, `app/server.ts`). Serves on port **11111**:
  `GET /race` returns the current snapshot; socket.io event `raceUpdate` pushes every change.
- Frontend: `cd trade && npm start` → http://localhost:3000 (CRA, desktop only).

## Simulation (replay a past day)

```
npx ts-node scripts/mock-run.ts [YYYY-MM-DD] [seconds per candle, default 3] [NY start HH:mm, default 08:30] [quotes]
npx ts-node scripts/mock-run.ts 2026-10-09 3 08:30 producion        # "full run": every stock
npx ts-node scripts/mock-run.ts 2026-10-09 3 08:30 TSLA,AFRM,SNOW   # a few tickers (SPY is added for the clock)
```

- `quotes`: a list name from `QuotesConfig` (`producion`, `development`) or comma-separated tickers. Defaults to
  `ActiveQuotesList`.
- Conventions with the trader: while developing, replay a short list (~5 stocks). A "full run" means **all stocks**
  (`producion`) starting **08:30**, the last hour before the bell. Then report the final board.
- A full run loads for ~4–5 minutes, then 08:30 → bell takes ~3 minutes at 3 s per candle. Poll `GET /race` until
  `phase` is `final` instead of waiting blindly. Don't start at 04:00 exactly (SPY has no candle yet; use 04:10).
- Needs port 11111: stop the live server (`npm run dev`) first.
- SPY loads first (it drives the mock clock), then all other stocks in parallel so the Alpaca client can batch them.
- Clock: 5 minutes per tick, but 1 minute per tick inside the decision window (09:15–09:30) so the forming
  candle can be watched. Data is real: 5-minute SIP bars, plus 1-minute bars for the decision window.
- To restart: kill the old process first, **in its own command**: `pkill -f "ts-node scripts/mock-run"`.
  Chained with the new `npx ts-node scripts/mock-run.ts ...` in one shell line, the kill matches and stops itself.
- After the bell the replay keeps going to the close (5 minutes per tick) so the market watch can be tested; the header
  clock keeps running ("Since the bell"). Good test day: `2026-09-23 3 08:30 RKLB,IONQ,ALAB,MU,AMD` (every verdict).
- The board marks it "Simulation". Daily history ends the day before the replay date (no look-ahead).

## Alpaca market data (free plan)

All in `app/proxy/alpaca-api.ts`.

- **SIP** (all exchanges) only for data older than 15 minutes. Newer data comes from **IEX** alone
  (~2–4% of volume), so live IEX volume is scaled by a per-symbol SIP/IEX ratio from recent bars.
- **`boats`** feed (Blue Ocean ATS, the 20:00–04:00 overnight session) works on the free plan; needed for
  24-hour hourly candles.
- Rate limit 200 requests/min; a Bottleneck limiter allows 190.
- **Batching:** `getBars` merges identical requests issued within 20 ms into multi-symbol calls (up to 100
  symbols each). Request many symbols at once (`Promise.all`) to benefit; sequential loading was the reason
  startup was slow and the clock looked frozen.
- Extended session = 04:00–20:00 New York; regular = 09:30–16:00.
- The 5-minute intraday call returns the in-progress bar; `proxy-service.getIntraday5Minute` removes it,
  `getIntraday5MinuteWithFormingCandle` keeps it (decision window only).
- Asset checks: `paper-api.alpaca.markets/v2/assets/{symbol}`. Snapshots: `/v2/stocks/snapshots?feed=iex`.

## Watchlist

`app/config/globals.config.ts` → `QuotesConfig`. `ActiveQuotesList` picks the list the engine follows:
`producion` (sic; the trading list, grouped into indexes, leaders, trending, smallcap) or `development` (SPY plus
AFRM, TSLA, AAPL, MSFT, CRCL, so restarts load in a minute or two). The `indexes` group (ETFs) loads but is
excluded from the race (`PremarketRace.excludeGroups`). Symbols on the board's Watching list are followed on top
of the active list.

Housekeeping done so far: dead tickers removed (ZI, GPS, DWAC), KR removed, and every ticker under $15
removed. Unconfirmed with the trader: "amkt" (AMKR?) and "aap" (AAP vs AAPL).

## Code map

| Path | Role |
|---|---|
| `app/config/globals.config.ts` | `PremarketRace` settings, mock settings, watchlist |
| `app/config/race-rules.config.ts` | Every rule threshold and scoring dial, with explanations |
| `app/engine/race-rules/` | Facts builder + elimination / qualification / scoring / warning rules |
| `app/engine/premarket-race.ts` | Orchestrator: registers stocks, evaluates rules, ranks, emits snapshots (throttled to 300 ms) |
| `app/engine/quotes-iterator.ts` | 5-minute loop, live forming-candle refresh, feeds the race |
| `app/proxy/mock-service.ts` | Replay: simulated clock, serves ended bars, rebuilds forming candles |
| `app/proxy/proxy-service.ts` | Mock/live switch, data clock, forming-candle window |
| `app/proxy/client-service.ts` | Express + socket.io (`/race`, `raceUpdate`) |
| `trade/src/race/` | React board: header, timing tower, side panel, filters, styles (`race.css`) |
| `trade/src/race/badges.js`, `Badge.jsx` | Every badge's explanation (tooltip) in one place; colors are `badge--<id>` in `race.css` |
| `app/engine/watchlist.ts` | The Watching list, saved to `data/watchlist.json` (gitignored) |
| `app/engine/market-watch/` | Intraday signals after the bell: orchestrator, facts, one file per signal in `signals/` |
| `app/config/market-watch.config.ts` | Market-watch dials and their calibration |
| `scripts/bb-touch-study.ts` | Calibration study for the upper-BB touch: `npx ts-node scripts/bb-touch-study.ts 2026-10-09 345 producion` (bars cached in /tmp) |
| `trade/src/race/NotificationCenter.jsx`, `useMarketWatch.js` | Bell, notification center, popups, desktop notifications |

`trade/` is its own git repo (`AngeiMachi/trade`, branch `master`), checked out inside this one (`algotrade`,
branch `alpaca`). Both push over HTTPS.

## Working notes

- The trader prefers minimal verification: run, do one quick check, move on ("no need to check all the time").
- Times in the trader's screenshots are usually Israel time (New York + 7 h in summer).
- When the trader reports a wrong ranking, reproduce it with a slow replay around the moment in question
  (e.g. `... 2026-10-06 15 09:15`) and compare snapshots candle by candle before changing rules.
