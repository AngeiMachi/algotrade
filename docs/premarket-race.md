# Opening Bell Race — pre-market strategy

The app ranks the watchlist before the US open so the trader can watch candidates trade places in real
time and pick from the top during the last 15 minutes before the bell. Long only for now; short mode is
wired in (`PremarketRace.direction`) and every rule mirrors itself automatically.

Old signals, star ratings and push notifications are switched off (`RunSignals`, `ShowStarRating`,
`Notifications.usePush` in `app/config/globals.config.ts`).

## The day

| New York | Israel (summer) | What happens |
|---|---|---|
| ~07:30 | ~14:30 | App starts (about 2 hours before the bell) and loads history for every stock |
| 04:00 → 09:30 | 11:00 → 16:30 | Pre-market race. One lap = one 5-minute candle, 66 laps |
| 09:15 → 09:30 | 16:15 → 16:30 | Decision window (last three candles). The board also counts the candle **still forming** |
| 09:30 | 16:30 | The bell. Opening price decides the final eliminations; standings freeze |

Pre-market always starts at **04:00 New York**. This matters: starting later (e.g. 07:00) produced the wrong
hourly candles and let GOOGL qualify when the trader's chart showed it closing under the 20 SMA.

## Before the race: liquidity filter

Stocks averaging fewer than `minAverageDailyVolume` (3M) shares a day over the last `averageVolumeDays` (20)
sessions are dropped at startup and never appear anywhere on the board (logged as "dropping …"). BNTX was
also removed from the watchlist by hand.

## Where a stock can be

| Status | Shown in | Meaning |
|---|---|---|
| `racing` | Standings | Passes every rule, ranked by score |
| `at-risk` | Standings (amber "Under SMA") | Trading below the hourly 20 SMA inside an open hourly candle |
| `out` (permanent) | Out for today, with the candle time | An elimination rule fired. Never comes back that day |
| `out` (temporary) | Out for today, "Until it breaks the high" | Below yesterday's high before the bell. Returns if it trades above it |
| `waiting` | Not qualifying | Below yesterday's close, thin volume, or no data yet |

## The rules (in evaluation order)

All rule code lives in `app/engine/race-rules/`, one file per kind, each rule a small object with `id`,
`title`, `describe()` and `check()`/`factor()`. Every number is in `app/config/race-rules.config.ts`.
The UI's "How the race is ranked" panel is generated from the same `describe()` text, so it never drifts.

`race-facts.ts` turns raw bars into plain numbers (gap, SMA, distances, hourly candles…). Rules only read
facts; they never touch bars. All percentages are "directional": positive = good side for the direction.

### 1. Elimination — permanent (`elimination-rules.ts`)

- **Hourly close through the 20 SMA.** Any pre-market hourly candle that *closes* more than
  `smaTolerancePct` (0.05%) below the hourly 20 SMA knocks the stock out for the day. Wicks touching or
  dipping below are allowed. (Trader's words: "it may touch or close a tiny bit through, but an hourly close
  below = out.")
- **Opened inside yesterday's range.** At the bell, the open must be **above yesterday's high** (long).
  Opening at or below it = out. This replaced "opened below yesterday's close", which it covers.

### 2. Qualification — temporary (`qualification-rules.ts`)

Each rule has `listedAs: 'out' | 'waiting'`, which decides which side list the stock sits in.

- **Trading past yesterday's high** (`listedAs: 'out'`). Before the bell, below yesterday's high = listed as
  out. The trader explicitly did not want a warning badge here: "as long as they are not opening on top
  they are not on the list". Skipped after the bell (the elimination rule decides with the real open).
- **Trading past yesterday's close** (`waiting`). Must be gapping up.
- **Enough pre-market volume** (`waiting`). At least `minPremarketDollarVolume` ($200K) traded. Kept
  gentle on purpose for now.

### 3. Score — ranks the race (`scoring-rules.ts`)

```
score = 100 × gapStrength × smaDistance × holdQuality × underSmaNow      (each factor 0..1)
```

Multiplying (not adding) means one bad trait drags the score down however strong the rest is.

| Factor | Formula | Why |
|---|---|---|
| Gap strength | `tanh(gapInAtr ÷ 1)`, where `gapInAtr = gap% ÷ daily ATR14%` | Gap measured in the stock's own volatility. Rises fast for the first ATR, then flattens: a huge gap is not automatically better (big gaps fade more often) |
| Distance from the 20 SMA | `1` within 0.5 ATR, then `exp(−½((d − 0.5) ÷ 0.5)²)`, where `d = (price − SMA20₁ₕ)% ÷ ATR14%` | Close to the SMA is healthy; far from it tends to pull back. 1 ATR keeps 61%, 1.5 ATR keeps 14% |
| Clean hold | `0.85 ^ touches` | Each pre-market hourly wick that dipped below the SMA costs 15%. Clean (never touched) is best |
| Under SMA right now | `0.5` while trading below the SMA in an open hourly candle | Live danger before the candle decides |

Ties break by gap. The Score cell tooltip shows the full breakdown.

The trader's reference examples (all must hold after any tuning):
- +3% gap, 0.5% from the SMA, clean → high score (healthy).
- +0.5% gap, close to the SMA, clean → ranks above the stretched case below.
- +5% gap but 4.5% above the SMA → warned and ranked low ("it can work but it's dangerous").
- Touched (wicked under, closes held — e.g. AAPL) stays in but ranks below the same stock clean.

#### Lesson: measure SMA distance in ATRs, not Bollinger σ

The first version used Bollinger z = (price − SMA) ÷ stdev of the same 20 hourly closes. After a quiet
overnight session the stdev collapses, so a normal breakout looked "3σ stretched". On Oct 6 this sank ALAB
(+3.67% gap, +2.85% above SMA, ATR 6%) to #63 when it was a perfect setup. Distance in daily ATRs
(Keltner-channel style) is immune to that squeeze; ALAB became #3.

### 4. Warnings (`warning-rules.ts`)

Warnings don't change the score (the score already prices the risk); they tell the trader what to look at.
Levels: `caution` (amber), `alert` (orange, row tinted), `danger` (marks the stock `at-risk`).

- **Stretched from the 20 SMA** — `caution` at ≥ 1 ATR ("Stretched"), `alert` at ≥ 1.5 ATR ("Very stretched").
  Shown as a badge next to the ticker and as a tinted "Above 20 SMA" cell with the ATR distance.
- **Trading through the 20 SMA** — `danger` while below the SMA inside an open hourly candle.

### 5. Highlights (`highlight-rules.ts`)

Good setups worth pointing out. Like warnings, they don't change the score. Shown as a blue badge next to
the ticker; the tooltip explains the numbers.

- **MA reclaimed** — yesterday the stock opened below the hourly 200 SMA (24-hour candles, the orange line on
  the trader's chart) and climbed to it during the regular session; today it trades above it (after the bell:
  opened above it). Details: "opened below" compares yesterday's daily open with the SMA entering the 09:00
  candle; "climbed to it" means a 09:00–15:00 hourly candle's high reached the SMA including that candle.
  Period in `RaceRulesConfig.reclaim.smaPeriod`. Reference case: ALAB, Oct 5 → Oct 6.
  The 24-hour hourly history is loaded 21 calendar days back so 200 candles are available.

## The 20 SMA must match the trader's chart

The hourly 20 SMA is computed on **24-hour hourly candles**: SIP bars for 04:00–20:00 plus the `boats` feed
(Blue Ocean ATS overnight session) for 20:00–04:00. That is what the trader's broker chart shows (its
Bollinger "MidLine" is the 20 SMA). Regular-hours-only or extended-only candles give a different SMA.

During the race, each new pre-market hour joins the SMA window once it completes; the current hour uses its
latest price. After the bell the last pre-market hour counts as complete.

## Ranking display

- Position, movement arrow vs. the previous candle, "New" for first appearance.
- "Top-3 laps": how many candles the stock spent in the top 3.
- Gaps between position numbers (e.g. 4, 6, 9) come from filters: the number is the overall rank, so hidden
  stocks (Clean/Touched filter, Uptrend, search) leave holes. Dismissed stocks are removed and the rest
  re-ranked.

## Board controls

- **Search** (main table and each side list). Filters the table only; ranks stay overall. Esc clears.
- **Uptrend toggle** — daily trend filter. A stock is in an uptrend if the daily 10 SMA > daily 20 SMA
  **or** today's price is above the daily 20 SMA (the open, after the bell). SMAs use closes before today.
  Periods in `RaceRulesConfig.trend`. Saved in localStorage.
- **All / Clean / Touched** — by how the stock held the hourly SMA. Saved in localStorage.
- **Dismiss (×)** — trader sets a stock aside for the day; it moves to "Dismissed by you" with Return /
  Return all. Saved per trade date in localStorage.

## Decision window: the forming candle

Lesson from Oct 6: AVGO climbed 23 → 10 in the 09:25–09:30 candle. With completed candles only, that move
appeared at the bell itself — too late to act. Now, from `decisionWindowStart` (09:15) to the bell:

- **Live:** every `formingCandleRefreshSeconds` (20 s) the engine refetches 5-minute bars *including* the
  in-progress one (Alpaca returns it; the normal 5-minute loop drops it on purpose).
- **Simulation:** the mock clock advances 1 minute per tick and rebuilds the forming candle from real
  1-minute bars.
- Movement arrows still compare to the previous *completed* candle. "Top-3 laps" counts once per candle.
  Hourly eliminations still wait for real hourly closes (none can close inside 09:15–09:30).
- Header shows "Live candle" and the real minute.

## Ideas not built yet

- "Climbing" badge for stocks gaining many places over the last few candles.
- Per-filter position numbers (1, 2, 3 within Clean) plus "#N overall".
- Volume and daily moving-average criteria for scoring; tuning the scoring dials on more replay days.
- Automatic minimum-price setting (today low-priced tickers were removed by hand).
