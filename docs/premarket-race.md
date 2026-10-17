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

### 0. Keep — always on the board (`keep-rules.ts`)

- **Opens outside the daily Bollinger band.** A stock above the daily upper BB (before the bell: its latest price;
  after: the open) stays on the board whatever the elimination and qualification rules say (trader: "they don't have
  to be healthy with the 20 SMA, they just need to open above the upper BB"). It is scored like the rest, so its
  score and warnings still show its health. When a rule was overridden it carries a pink-outline **Kept: BB** badge
  saying what it would have failed. Its elimination is still remembered: if it falls back inside the band before
  the bell, it is out again. Sep 23 replay: MU, ALAB, AMD closed an hour under the 20 SMA and were kept.

### 1. Elimination — permanent (`elimination-rules.ts`)

- **Hourly 20 SMA pointed down yesterday.** Its angle at yesterday's last hourly candle (the score's smaSlope
  measure) under `minPriorSmaSlopeAtr` (0) = out for the day: a turn, not a trend. Only the keep rule (above the
  daily upper BB, a massive jump like earnings) keeps it on the board. The market watch's 20 SMA reclaim uses the same rule.
- **Hourly close through the 20 SMA.** One of the last `hourlyCloseLookbackHours` (4: the 05:00–08:00 candles)
  pre-market hourly candles that *closes* more than `smaTolerancePct` (0.05%) below the hourly 20 SMA knocks the
  stock out for the day. Wicks touching or dipping below are allowed. (Trader's words: "it may touch or close a tiny
  bit through, but an hourly close below = out.") An hour without trades does not count: it carries the previous
  close while the SMA keeps moving (ECHO Oct 5: no trade from Friday 16:00 to Monday 07:40; the rising SMA passed
  the frozen 93.02 at 05:00).
- **Opened inside yesterday's range.** At the bell, the open must be **above yesterday's high** (long).
  Opening at or below it = out. This replaced "opened below yesterday's close", which it covers.
  **Exception — reclaimers:** a stock with "MA reclaimed" (reclaimed the hourly 200 SMA on the open) may stay
  even though it opened below yesterday's high, as long as every other rule passes. It carries a red
  `danger` warning, "Opens below" ("Below high" before the bell), from `belowPreviousExtreme` in
  `warning-rules.ts`. The same exception applies to the pre-market "Trading past yesterday's high" rule.
  Only `tradingThroughSma` marks a stock at risk; other `danger` warnings just show red.
  **Exception — near high** (`near-previous-extreme.ts`, settings `RaceRulesConfig.nearPreviousExtreme`): a
  stock at most **0.1 daily ATR** under yesterday's high stays eligible when it holds the hourly 20 SMA and shows
  conviction: at least **0.25 ATR** above yesterday's close, or unusual volume (RVOL ≥ 1.5×). Within **0.05 ATR**
  (`atHighAtr`, half the noise) it is at the high and needs no conviction (SHOP Oct 5: on the board all morning,
  opened 0.15% = 0.035 ATR under Friday's high on a 0.21 ATR gap and quiet volume, and was dropped). Amber "Near high"
  badge. Measured in ATRs so calm and wild stocks get the same allowance (ATR 2% → 0.2% under / +0.5% gap; ATR
  5% → 0.5% / +1.25%). Why 0.1 ATR: one 5-minute candle typically ranges ATR ÷ √78 ≈ 0.11 ATR, so less than that
  under the high is noise. Checked on daily candles of the trading list, Sep 28 – Oct 9 (open→close, in ATRs):
  opens above yesterday's high −0.058 avg / 43% green (234); near-high exception −0.059 / 42% (33, about 3 a day);
  0.1–0.5 ATR under with the same gap −0.120 / 37% (97). The exception group behaves like the eligible group;
  farther under is clearly worse, so the line sits at 0.1 ATR.

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
score = 100 × gapStrength × smaDistance × volume × smaSlope × underLongSma × holdQuality × underSmaNow
```

Multiplying (not adding) means one bad trait drags the score down however strong the rest is. Each factor is 0..1
except volume (0.76..1.32).

The trader's weighting (Oct 12): closeness to the 20 SMA matters most, a gap matters (somewhat substantial, not
huge), volume is a nice confirmation; far from the SMA is a clear "not first", and big volume there can be a
warning. Oct 12 at the open SHOP (gap 0.43 ATR, 0.26 ATR above the SMA, RVOL 2.4×) was the clear winner (+3.7% by
the close) but ranked 7th behind CRM, NOW and EBAY (all ~0.66 ATR above the SMA). With the curves below SHOP ranks
1st and those three ~20th.

| Factor | Formula | Why |
|---|---|---|
| Gap strength | `g² ÷ (g² + 0.25²)`, where `g = gapInAtr = gap% ÷ daily ATR14%` | Gap measured in the stock's own volatility. An S curve: 0.1 ATR → 0.14, 0.25 → 0.5, 0.5 → 0.8, 1 → 0.94. A tiny gap is worth little, past ~0.5 ATR more gap adds little (big gaps fade more often) |
| Distance from the 20 SMA | `1` within 0.15 ATR, then `exp(−½((d − 0.15) ÷ 0.3)²)`, where `d = (price − SMA20₁ₕ)% ÷ ATR14%` | The most important trait. 0.35 ATR keeps 80%, 0.55 (stretched) 41%, 0.66 24%, 1 ATR 2% |
| Volume | `RVOL ^ (0.2 × (2 × smaDistance − 1))`, RVOL (pre-market) kept in 0.25..4 | Read through the distance: near the SMA busy volume confirms (RVOL 2.4 → 1.19, 4+ → 1.32) and quiet costs (0.5 → 0.87); past ~0.5 ATR away busy volume is a warning (a buying climax: down to 0.76) and quiet is not rewarded. No RVOL yet → 1 |
| Angle of the 20 SMA | `0.25 + 0.75 × ½(1 + tanh((s − 0.1) ÷ 0.1))`, where `s = SMA20₁ₕ change over the last 10 completed hours ÷ ATR14%` | Which way the SMA points going into the open. Over 10 hours its change compares the last 10 hourly closes with those 20-30 hours back, so it reads the day before into the pre-market. Rising 0.3 ATR+ keeps ~100%, 0.2 → 91%, 0.1 → 63%, flat → 34%, falling → 25%. Oct 9: AFRM +0.51, SNOW +0.36, TSLA +0.24 (up), META +0.06 (flat, 48%) |
| Under the hourly 200 SMA | `0.5` when the price (the open, after the bell) is under the hourly 200 SMA in both readings | Outweighs the angle: a gently rising 20 SMA above the 200 (0.1 ATR → 0.63) beats a steep one under it (1 × 0.5) |
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

- **Stretched from the 20 SMA** — `caution` at ≥ 0.55 ATR ("Stretched"), `alert` at ≥ 1 ATR ("Very stretched").
  Calibrated on the trader's calls: ALAB Oct 6 at 0.48 ATR was not extended; XOM 0.61, OXY 0.64 and PLTR 0.74
  on Oct 8 were.
  Shown as a badge next to the ticker and as a tinted "Above 20 SMA" cell with the ATR distance.
- **Trading through the 20 SMA** — `danger` while below the SMA inside an open hourly candle.

### 5. Highlights (`highlight-rules.ts`)

Good setups worth pointing out. Like warnings, they don't change the score. Shown as a badge next to
the ticker; the tooltip explains the numbers.

### Badges

Every badge has its own color and icon, and a tooltip above it: the badge name, what it means in general
(`trade/src/race/badges.js`), then this stock's numbers. Colors are the `badge--<id>` classes in `race.css`.
A solid fill is the strong form of a hue.

| Badge | Color | Icon |
|---|---|---|
| Strong uptrend / Uptrend / Downtrend (daily) | solid bright green / green / red | double arrow up / trending up / trending down |
| Clean / Touched N× | very light blue / grey outline | check circle / target dot |
| Under 20 SMA | solid red | arrow to bottom line |
| Opened below high (reclaimer) / Near high | orange / cyan | down arrow / arrow to top line |
| Stretched / Very stretched | yellow / solid yellow | warning |
| MA reclaimed / Trending volume / Above upper BB | violet / fuchsia / pink | graph / bar chart / expand |
| Pattern breakout / Near breakout | solid teal / dashed teal outline | chart line |
| Watch | white dashed outline | eye |

- **MA reclaimed** — yesterday the stock opened below the hourly 200 SMA (24-hour candles, the orange line on
  the trader's chart); today it opens above it (before the bell: trades above it). Trader's definition: reclaiming
  is about *opening* above it the next day, not touching it — whether yesterday crossed it during the session or
  stayed below all day doesn't matter. "Opened below" compares yesterday's open with the SMA entering the 09:00
  candle. Period in `RaceRulesConfig.reclaim.smaPeriod`.
  **Both SMA readings must agree** (see below): yesterday's open below the lower reading, today's price above the
  higher one. Reference cases: ALAB Oct 6 yes; TEAM Oct 6 no (opened above the line on Oct 5); EBAY Oct 7 no
  (opened 107.76, under the chart's 108.3 — the filled reading alone said 106.8 and wrongly flagged it).
  The hourly history is loaded 45 calendar days back so 200 traded-only candles are available.
- **Trending volume** — pre-market volume so far is ≥ 1.5× (RVOL; 1.5 rather than 2 so ALAB's busy Oct 6 at 1.6× counts) the average of the last 10 sessions *up to the
  same 5-minute candle* (an 08:40 reading is compared with past 08:40 readings, because pre-market volume piles
  up toward the bell). Ignored before 05:00, when the numbers are too small. Only given to stocks that also pass
  the gap (above yesterday's close and yesterday's high). Violet badge, unlike the blue "MA reclaimed". The RVOL column shows the ratio for
  every stock. History is SIP 5-minute bars, so replays are exact; live, today's volume is scaled IEX and the ratio
  is approximate. Settings in `RaceRulesConfig.relativeVolume`.
- **Above upper BB** — the price (the open, after the bell) is above the daily upper Bollinger band (20 days,
  2σ, population σ). The band is drawn as the daily chart shows it at the open: the last 19 daily closes plus
  today's price as the 20th. Before the bell it means the stock is set to open outside the band. Pink badge.
  Settings in `RaceRulesConfig.bollinger`.
- **Chart pattern breakout** (`race-rules/chart-patterns.ts`, the trader's idea Oct 17; detection only, not
  back-tested) — classic bullish patterns on the last 120 daily candles. Swing highs/lows = the extreme of 3
  candles each side. The resistance = a line from a swing high touched ≥ 3 times (any candle within 0.25 ATR, at
  least 3 days apart), ≥ 10 days long, last touch ≤ 30 days ago, unbroken until yesterday. A candle testing the line
  is not the break yet: a close up to 0.4 ATR / a wick up to 0.5 ATR over it is allowed (CSCO Oct 1 sat on the line
  from its Aug 10 top, then opened 0.94 ATR above it Oct 2 — the trader's breakout). Every valid line is kept and the
  one today's price breaks counts. A breakout counts on its first day and the day after ("(day 2)" on the badge:
  yesterday's lines still ≥ 0.1 ATR under the price, plus any new line broken today), then no badge until 5 sessions
  passed since a breakout that opened above and closed above its line (CSCO: Oct 2, day 2 Oct 5, nothing Oct 6). A
  breakout that closed back under the line failed and does not count (AVGO Sep 29; the real one Oct 5, through the
  line from its Aug 10 top; day 2 Oct 6, through the Aug 28 line as well). The support under it and the two slopes name it: falling trendline, falling
  wedge, descending / symmetrical / ascending triangle, range, resistance. Plus bull flag (≥ 3 ATR pole in ≤ 8 days,
  3–15 days of flag giving back ≤ half) and double bottom (two lows within 0.5 ATR, ≥ 8 days apart, neckline ≥ 1.5
  ATR above). "Breakout" (solid teal) when the price (the open, after the bell) is ≥ 0.1 ATR above the line / flag
  top / neckline; "Near breakout" (dashed) up to 0.3 ATR under it. The tooltip says how it is drawn. Checks
  (before the line rework): Oct 15, 20 big names:
  only ADBE (symmetrical triangle) and NFLX (falling wedge). Patterns are drawn once per stock and day (cached).
  "Breakout" toggle on the Race and Alerts tabs. Settings in `RaceRulesConfig.chartPatterns`.

## The 20 SMA must match the trader's chart

The hourly 20 SMA is computed on **24-hour hourly candles**: SIP bars for 04:00–20:00 plus the `boats` feed
(Blue Ocean ATS overnight session) for 20:00–04:00. That is what the trader's broker chart shows (its
Bollinger "MidLine" is the 20 SMA). Regular-hours-only or extended-only candles give a different SMA.

**Empty hours are filled.** The broker draws a candle for every hour of a trading session, even when nothing
traded (common overnight); the empty candle repeats the previous close. Skipping those hours makes the SMA
window reach further back in time, which is how TEAM was wrongly flagged "MA reclaimed" (its 200 SMA came out
above its Oct 5 open). The overnight 20:00–04:00 belongs to the next trading day, so weekends and holidays
stay empty. With filling, TEAM's 20 SMA is 196.62 vs 196.64 on the chart; the 200 SMA is ~0.4% off (the broker
likely has overnight trades Alpaca doesn't), so borderline reclaims (e.g. NOW, 0.07% away) can still differ.
The filling runs right up to the race (04:00), so a stock with no overnight trades still gets those hours.

**The 200 SMA can't be matched exactly.** The broker seems to skip hours with no trades, but its overnight data is
richer than Alpaca's `boats` feed. So the chart's 200 SMA lands between two readings of our data:

| Stock / time | Chart | Empty hours filled | Traded hours only |
|---|---|---|---|
| TEAM Oct 6 13:00 | 187.23 | 186.40 | 188.94 |
| EBAY Oct 7 02:00 | 108.29 | 106.88 | 108.21 |

The race keeps the filled candles for the 20 SMA (it matches the chart: TEAM 196.62 vs 196.64, EBAY 106.78 vs
106.84). "MA reclaimed" uses both 200 SMA readings and only counts a side of the line when both agree.

The trader's chart shows **Israel time** (New York + 7h): the "16:00" candle there is the 09:00 New York candle.

During the race, each new pre-market hour joins the SMA window once it completes; the current hour uses its
latest price. After the bell every price-based number (gap, score, SMA distance, warnings, badges) uses the
opening price instead of the last pre-market print, and the "Last" column shows the open (SNOW Oct 9: last
pre-market print exactly at yesterday's close, then opened above yesterday's high). The 09:00 candle is still forming at the bell (on the chart it runs to 10:00), so a dip under the
SMA in its pre-market half is not an hourly close: it marks the stock "Under SMA" and halves its score, but does
not knock it out (SNOW Oct 9: 0.16% under at 09:25, while the hourly candle closed far above).

## Ranking display

- Position, movement arrow vs. the previous candle, "New" for first appearance.
- "Top-3 laps": how many candles the stock spent in the top 3.
- Gaps between position numbers (e.g. 4, 6, 9) come from filters: the number is the overall rank, so hidden
  stocks (Clean/Touched filter, Uptrend, search) leave holes. Dismissed stocks are removed and the rest
  re-ranked.

## Board controls

- **Search** (main table and each side list). Filters the table only; ranks stay overall. Esc clears.
- **Trend switch** (All trends / Strong uptrend / Uptrend / Downtrend) — daily trend. Uptrend: today's price (the
  open, after the bell) is above the daily 10 SMA and the daily 20 SMA (includes strong ones). Strong uptrend: also
  the 10 SMA above the 20 SMA. Downtrend: the price is below both. Between the two SMAs a stock is neither. SMAs use
  closes before today. Periods in `RaceRulesConfig.trend`. Combines with the Clean/Touched switch; the podium title
  follows ("Top 3 clean strong uptrend"). Saved in localStorage.
- **Trending volume / MA reclaimed toggles** — show only stocks with that badge. Toggles combine (a stock must
  match every toggle that is on); each shows "matching of total". The list lives in `toggleFilters` in `RaceScreen.jsx`.
- **Favorites (star column)** — starred stocks are pinned to the top of the table, above any sort, with a
  divider under them. The side panel's top 3 ignores them. Saved in localStorage for one day: each star expires
  13 hours after it was set (`race.favorites`, quote → time starred).
- **Watching (side panel, under the top 3)** — stocks to keep an eye on across days, saved on the server in
  `data/watchlist.json` (gitignored; `GET/POST /watchlist`, `DELETE /watchlist/:quote`, pushed live as
  `watchlistUpdate`). Add any symbol in the free-text box, or with the eye on a table row or on the "Out for today"
  and "Not qualifying" lists. A watch overrides the rules for display only: every watched stock is listed with its
  state (`#rank in the race`, `Out · reason`, `Not qualifying · reason`, left out before the race with the reason,
  `Loading…`, or `No data`), its gap and its price. The engine follows a watched symbol even if it is not in
  `QuotesConfig`, and never deprecates it; the race rules still decide whether it ranks. A watched stock that is in
  the standings table carries a blue **Watch** tag. The snapshot carries the list as `watched`.
- **Column sorting** — click any column header to sort; click again to flip. Pos (the race order) is the default.
  Sorting only reorders rows: positions, podium colours and the top 3 stay by race rank. Saved in localStorage.
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

## Market watch (during the session)

The infrastructure for intraday signals: `app/engine/market-watch/`, numbers in `app/config/market-watch.config.ts`.
It follows the race's stocks after the bell (the race board itself stays frozen; the clock keeps running).
Each signal is one file in `signals/` with `watches()`, `detect()` and `status()`, and is **pure**: from the day's
candles so far it returns every event, with a stable id, so restarts and replays rebuild the same alerts. To add a
signal: write the file, add it to `signals/index.ts`; its `describe()` joins the rule book.

Board: the **Alerts** tab (next to Race) has one headed section per group (signal). Each ranks its stocks like the
race: buy setups and "Get ready" carry a score (100 × factors, each shown with its note), a stock's score adds its live
setups (a reclaim in both hours adds both), and stocks without a live setup follow, newest first. So a strong setup
that came early stays on top. Search, group and call filters, the race's own filters (`raceFilters.jsx`: Trending
volume, MA reclaimed, Above upper BB, daily trend, Clean/Touched; judged on the stock's race entry, a stock the race
never scored passes none; saved apart from the Race tab's), read marks, Desktop and Sound switches, and who each
signal is watching. The stages of one event (`eventId`: a touch and its hold, a reclaim forming and closing) form one
row, judged by the latest stage. Calls: Buy setup (popup that stays, chime), Get ready (quiet popup that fades), Avoid
and Wait (tab only). Alerts of one update are collected for 0.8 s; at most 3 reclaim popups and 3 first-candle popups
are on screen, the best scores (many stocks reclaim at the same hour close; every first candle lands at 09:35). A
signal can lead the tab for a while (`leadsForMinutes`): the first candle is listed first until 20 minutes after the
bell, then last. Clicking a popup opens the tab. Alerts older than 10 minutes on the data clock (rebuilt after a restart) only go to
the tab. Live, the forming candle of armed stocks is refetched every 20 s, so a touch shows within seconds (IEX prices live).
Endpoints: `GET /market-watch`; socket `marketWatchUpdate` (state) and `marketAlert` (`{ alert, live }`).

### Signal: green first candle (`first-candle.ts`)

The trader's idea (Oct 17), not back-tested. At 09:35, the stocks on the final board that were healthy pre-market
(no hourly close through the 20 SMA) and opened above the hourly 20 SMA, whose first 5-minute candle closed above its
open. A red first candle is out for good; a stock kept on the board under the 20 SMA (e.g. above the daily upper BB)
is not watched. A stock dismissed on the Race tab never shows in it, nor pops up (the board filters it: the engine
ignores dismissals). Why: many healthy stocks get smashed in the first 5 minutes, others run so far from the 20 SMA that
buying is late; the best went up a little and still have room. Rated with the race's own `scoreRacer` on the race's
facts at the open, with the price moved to the candle's close (gap, SMA, distance follow it), so the distance factor
decides most. The race's pre-market volume factor is swapped for the first candle's volume against a normal first
candle (ratio ^ 0.3, between 0.8 and 1.3): unusual volume lifts a stock but never past one much closer to the SMA.
0.8 ATR or more above the SMA is a "Wait" instead of a buy setup (looser than the race's 0.55: UNH Oct
15 at 0.61 is the trader's good example). Oct 15: UNH 51 at the open → 27 (+0.18 ATR candle, 0.61 ATR from the
SMA), ADBE 38 → 1.2 (+0.61 ATR, 1.02 ATR: ran away). The race hands its board with each stock's facts to the market
watch (`setBoard`), so `IWatchFacts.race` carries them.

### Signal: reclaim of the hourly 20 SMA (`sma-reclaim.ts`)

The trader's setup, not back-tested. Watches stocks on the final board or healthy pre-market (no pre-market hourly
close through the 20 SMA; stocks dismissed by hand count, the engine ignores dismissals), in the board's daily
uptrend. In the first two hourly candles of the session (clock hours on the 24-hour chart: 09:00–10:00, whose last
half is the first half hour, and 10:00–11:00), when the candle dips under the hourly 20 SMA and buyers take it back
while the SMA points up (≥ 0.1 ATR over 10 hours, the score's "rising").

The candle must be a **hammer or a cross on the SMA** (daily ATRs): the low at least 0.1 ATR under the SMA (a real
test, not a tick through), the close at most 0.4 ATR above it (still close: further up it has run away and may come
back down, like UBER on Oct 9 at 0.81 ATR), and a fight: at least 0.4 ATR from high to low with the body at most 55%
of it, the rest wicks (a small full-body green candle says nothing, it may just as well stay put). On the Oct 9 full
run this kept AFRM, GME, PLTR 10:00, ABNB, GM and ECHO (HPE is out: its 09:00 candle closed under).

| Stage | When | Call |
|---|---|---|
| Forming | at hh:55 the candle dipped under the SMA and is back above it, close to it | Get ready |
| Closed above | the hourly candle closes above the SMA, close to it | **Buy setup** (below the hour's low the setup is wrong) |
| No setup | closed above the SMA, but the close ran away, the hour barely moved or it is mostly body | Wait |

A low less than 0.1 ATR under the SMA never touched it (ETSY Oct 12: 6 cents, 0.02 ATR, not under it on the trader's
chart): no entry at all.
| Lost it | it was Forming but closed under the SMA | Avoid |

Nothing triggers before 10:00 (first Get ready 09:55). Both hours can trigger, but once a watched hourly candle has
closed under the SMA the stock is out for the day (HPE Oct 9: the 09:00 candle closed at 71.40 under 71.84).
A stock whose hourly 20 SMA pointed down yesterday (its angle at yesterday's last hourly candle under
`minPriorSlopeAtr`, 0) is out too: that is a turn, not a trend (ECHO Oct 9). Only opening above the daily upper
Bollinger band (a massive jump, earnings) lets it in.

Every reclaim close is rated, buy or not: 100 × angle × dip depth × closeness to the SMA × **volume**. Volume = today's volume from 04:00 through the alert's candle ÷ the 10-session average up
to the same time (RVOL, which projects the day), as RVOL^0.5 between 0.5 and 1.5: quiet halves the score at most,
busy lifts it by half at most. The BB buy setup gets the same volume factor. Live, volume older than 15 minutes is
SIP and the last 15 minutes are IEX scaled per stock, so no second data source is needed. On the tab each column
lists every stock as a card: live setups first, then the rest, by rating.

Decision badges on each card (`alert-badges.ts`, thresholds in `MarketWatchConfig.badges`), beside the score because
the ranking is not always right, drawn in the race board's language (same icons and hues for the same idea): On the
board, a **live volume badge** (updated through the session, not frozen at the alert: Trending volume when RVOL ≥ 1.5,
Volume when normal, Quiet volume, its dim dashed form, under 0.7; with the trend arrow ↑ rising / → steady / ↓ fading =
the last 30 minutes against normal for those minutes, compared with the 30 before, ≥ 1.2× or ≤ 0.8×, so the normal fade
after the opening rush reads steady), Steep 20 SMA
(≥ 0.3 ATR, Clean's light blue), Deep test (reclaim dipped ≥ 0.3 ATR under: the solid form of Touched), Tight stop
(≤ 0.25 ATR to where the setup is wrong) or Wide stop (≥ 0.6 ATR: smaller size, Stretched's yellow), Room to the high
(today's high ≥ 0.5 ATR above, with yesterday's-high's arrow). Each card has an × to dismiss the stock from that
column (no popups from it there); a "Dismissed" fold at the bottom brings it back. Saved per day in the browser. Oct 9 replay: AFRM Get ready 09:55,
buy setup 10:00 at 78.66.

### Signal: back to the upper Bollinger band (`upper-band-touch.ts`)

Watches every stock that opened above the daily upper BB. A touch = a 5-minute candle's low reaches the band, drawn as
the live daily chart draws it (last 19 closes + the price). It must have been ≥ 0.15 ATR above the band first, and
re-arms after a candle closes 0.15 ATR above. The verdict reads how the price got there (the trader's observation:
slow slides keep sliding, fast drops jump back):

| Verdict | Rule | Touch alert |
|---|---|---|
| Heavy selling | volume on the last 4 candles ≥ 1.5× the session's median candle | Avoid |
| Opening dip | in the first 15 minutes | Wait |
| Fast drop | ≥ 0.3 ATR in the last 4 candles, ≥ 60% of the way down from the high, before 13:30 | Wait |
| Slow slide | ≥ 8 candles since near the high, < 0.2 ATR in the last 4 | Avoid |
| Touched | anything else | Wait |

A touch under the hourly 50 SMA is Avoid whatever the verdict. **Buy setup ("Held the upper BB", popup + chime):**
after a Wait touch, on a stock healthy with the hourly 20 SMA pre-market (no hourly close through it) and above the
hourly 50 SMA at the touch, a 5-minute candle closes back above the touch within 30 minutes before any close 0.15 ATR
under the band. The alert carries the trade: target halfway back to the high (≥ 0.3 ATR), out on a 5-minute close
0.15 ATR under the band, break-even once it bounced 0.15 ATR. Traded that way over the year on the 30 highest-volume
stocks (`scripts/bb-touch-health.ts`): 52 setups, 31% target, 29% break-even, 15% stopped, 25% still open after 2 hours
(mostly up), +0.06 ATR a trade. Buying at the touch instead averages 0 ATR whatever the health; waiting for the close
back above halves the losers. Holding the 50 SMA after breaking the 20 did not help; under the 50 was the worst group.

Calibrated with `scripts/bb-touch-study.ts` (Oct 2025 – Oct 9 2026, trading list, 770 touches; outcome = first to
move 0.15 ATR up or down within an hour; base 42% up / 44% down): fast drop 134 touches, 57% up / 38% down, stable
in both halves of the year; heavy selling up beat down 32%; opening touches 43% / 55%; slow slides up beat down 40%
with small moves. A modest edge: a setup to look at, not a sure bounce. Finding against the classic "capitulation"
idea: heavy volume into the band did *not* bounce. Sep 23 replay: IONQ 11:35 fast drop (bounced), RKLB 13:00 slow slide.

Checked and dropped (no edge, Oct 2025 – Oct 2026): opening-range breakout (15-minute high, 1R target vs the range
low) averages ~0 R whatever the gap.

## Ideas not built yet

- "Climbing" badge for stocks gaining many places over the last few candles.
- Per-filter position numbers (1, 2, 3 within Clean) plus "#N overall".
- Volume and daily moving-average criteria for scoring; tuning the scoring dials on more replay days.
- Automatic minimum-price setting (today low-priced tickers were removed by hand).
