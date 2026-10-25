// Every number the market watch uses. The signals themselves live in app/engine/market-watch/signals.
// Distances are in daily ATRs like the race. A "normal candle" is the typical 5-minute move:
// ATR ÷ √78 ≈ 0.11 ATR (78 candles in a session, random-walk scaling).

export const MarketWatchConfig = {
    // Live only: how often the candle still forming is refetched for the watched stocks during the session, so a
    // touch is caught within seconds instead of at the candle's close.
    formingCandleRefreshSeconds: 20,

    // An alert counts as live (popup + desktop notification) when its candle is at most this old on the data clock.
    // Older ones (found after a restart) only go to the notification center.
    liveAlertMinutes: 10,

    // "Upper BB touch": a stock that opened above the daily upper Bollinger band comes back down to it.
    //
    // Calibrated with scripts/bb-touch-study.ts on the trading list, Oct 2025 – Oct 9 2026 (SIP 5-minute bars):
    // 1,326 stock-days opened above the band, 770 touches after a real move away. Outcome = which comes first within
    // an hour, 0.15 ATR up or 0.15 ATR down from the touch. Base rate over all touches: 42% up / 44% down.
    //   Fast drop, 09:45–13:30, normal volume   134 touches  57% up / 38% down  (Oct–Apr 64/34, Apr–Oct 51/41)
    //   Fast drop in the first 15 minutes        opening chop: 43% up / 55% down over all opening touches
    //   Heavy volume on the way down (≥ 1.5×)    real selling: went further up than down only 32% of the time
    //   Slow slide (8+ candles, gentle arrival)  107 touches  went further up than down 40%; small moves both ways
    // The edge is real but modest: a fast-drop alert is a setup to look at, not a sure bounce.
    //
    // Traded the trader's way (scripts/bb-touch-health.ts, 30 highest-volume stocks, 205 touches): target halfway
    // back to the high (≥ 0.3 ATR) within 2 hours, out on a 5-minute close 0.15 ATR under the band, break-even once
    // it bounced 0.15 ATR. Buying at the touch averages 0 ATR whatever the health. Waiting for a 5-minute close back
    // above the band halves the losers. The buy setup = that close, on a stock healthy with the hourly 20 SMA
    // pre-market, above the hourly 50 SMA at the touch, not a slow slide or heavy selling:
    //   52 trades: 31% target, 29% break-even, 15% stopped, 25% still open after 2 h (8 of 13 up); +0.06 ATR a trade.
    //   Under the hourly 50 SMA at the touch: the worst group (27 touches, 11% target / 44% stopped at the touch).
    //   Broke the 20 SMA pre-market but held the 50: no better than average (7% target on the confirmed entry).
    upperBandTouch: {
        // The price must have been at least this far above the band since it was armed, or it was only hugging the
        // band (227 such touches: 42% up / 58% down, no signal).
        minExcursionAtr: 0.15,
        // After a touch, a candle must close this far above the band before another touch can alert.
        rearmAtr: 0.15,
        // The approach: how fast the price came down to the band.
        // `recentCandles` is the trader's "1 to 4 candles": the drop over that window decides "fast".
        recentCandles: 4,
        // Fast drop (bounce expected): the last `recentCandles` candles fell at least this far, in ATRs (≈ 2.7
        // normal candles of movement) ...
        fastDropAtr: 0.3,
        // ... carrying at least this share of the whole way down from the high (it was up there, then fell) ...
        fastShare: 0.6,
        // ... in the bounce window: not the opening chop, not the quiet late session (240+ minutes: tiny moves) ...
        fastFromMinute: 15,
        fastUntilMinute: 240,
        // ... and without heavy volume, which marks real selling rather than a flush.
        heavyVolumeRatio: 1.5,
        // Slow slide (more downside expected): the descent took at least this many candles ...
        slideMinCandles: 8,
        // ... and the last `recentCandles` candles fell less than this, in ATRs (arrived gently).
        slideMaxRecentDropAtr: 0.2,

        // The buy setup: after the touch, a 5-minute candle closes back above the band within this many candles ...
        confirmWithinCandles: 6,
        // ... before any candle closes this far under the band, in ATRs (also the stop: bail out on such a close).
        stopAtr: 0.15,
        // Target: halfway back to the high it fell from, at least this far above the buy, in ATRs.
        targetMinAtr: 0.3,
        // Once it has bounced this far (ATRs), a return to the buy price is a break-even exit.
        breakevenAfterAtr: 0.15,
        // Health: no pre-market hourly candle closed through the race's hourly SMA (globals smaPeriod, 20), and at the
        // touch the price is above this longer hourly SMA.
        trendSmaPeriod: 50,
        // Score of a buy setup (ranks the BB section of the Alerts tab; not back-tested):
        //   100 × angle of the hourly 20 SMA at the touch (the race's factor) × quick hold × reward × volume
        //   quick hold = 1 if the first candle after the touch closes back above, down to slowestHoldFactor at the
        //   last allowed one. reward = tanh((target − buy) ÷ (buy − stop) ÷ rewardRiskScale): 1:1 → 0.46, 2:1 → 0.76.
        score: {
            slowestHoldFactor: 0.5,
            rewardRiskScale: 1,
        },
    },

    // "Hourly 20 SMA reclaim" (the trader's setup, not back-tested): in the first hours of the session an hourly
    // candle (24-hour chart, clock hours) dips under the hourly 20 SMA, buyers take it back and it closes above,
    // while the SMA points up. Watched on stocks on the final board or healthy pre-market (no pre-market hourly close
    // through the 20 SMA), in the board's daily uptrend.
    // Volume factor in both setup scores. RVOL = today's volume from 04:00 through the alert's candle ÷ the average of
    // the race's relativeVolume.days sessions up to the same time; the same ratio projects the day's volume.
    //   factor = RVOL ^ exponent, kept between minFactor and maxFactor
    //   → 0.25× normal: 0.5, 0.5×: 0.71, normal: 1, 1.5×: 1.22, 2×: 1.41, 2.25× or more: 1.5.
    // A quiet stock loses up to half its score; a busy one gains up to half. Live, volume older than 15 minutes is SIP
    // (every exchange) and the last 15 minutes are IEX scaled by the stock's SIP/IEX ratio: good enough for a ratio.
    volume: {
        exponent: 0.5,
        minFactor: 0.5,
        maxFactor: 1.5,
        minDays: 3,
        // The live volume badge's trend: the last `trendWindowMinutes` against a normal day's same minutes, compared
        // with the window before. Both are against normal for their time of day, so the usual fade after the opening
        // rush reads as steady, not fading. At least `risingRatio` = rising, at most `fadingRatio` = fading.
        trendWindowMinutes: 30,
        risingRatio: 1.2,
        fadingRatio: 0.8,
    },

    // Decision badges on setups (alert-badges.ts), not part of the score: they say why a lower score may still be
    // worth a look, or a high one is not.
    badges: {
        // Busy: RVOL at least this (the race's Trending volume bar); quiet: under this.
        busyVolume: 1.5,
        quietVolume: 0.7,
        // Steep 20 SMA: rising this many ATRs over 10 hours (the score's angle is maxed out here).
        steepSlopeAtr: 0.3,
        // Deep test (reclaim): the hour went this far under the SMA and was bought back.
        deepDipAtr: 0.3,
        // Stop size, buy to the level where the setup is wrong (the hour's low; the BB stop): tight at most this ...
        tightStopAtr: 0.25,
        // ... wide from this on (a smaller position for the same risk).
        wideStopAtr: 0.6,
        // Room to the high: today's high (from 04:00) is at least this far above the buy, a natural first target.
        roomToHighAtr: 0.5,
    },

    // "Green first candle" (the trader's idea, Oct 17): at 09:35, the race's healthy board stocks above the hourly 20 SMA
    // whose first 5-minute candle closed above the open. Many healthy stocks get smashed in those 5 minutes (out), others
    // run so far from the 20 SMA that buying is late. The best ones went up a little and still have room, so the list
    // is ranked by the race's own score with the price moved to that candle's close: the distance factor bites past
    // 0.15 ATR from the SMA, so a stock that ran away (ADBE Oct 15) sinks under one that stayed close (UNH Oct 15).
    // Oct 15 replay: both opened 0.44 ATR above the 20 SMA. UNH closed the candle +0.18 ATR at 0.61 ATR from the SMA
    // (score 51 at the open → 27); ADBE ran +0.61 ATR to 1.02 ATR (38 → 1.2).
    firstCandle: {
        // Listed first on the Alerts tab until this long after the bell, then moved to the bottom.
        leadMinutes: 20,
        // At or past this distance from the 20 SMA at 09:35 (daily ATRs) it is a "Wait", not a buy setup. Looser than
        // the race's "stretched" 0.55: one green candle adds distance, and UNH at 0.61 is the trader's good example.
        // 0.8 sits between UNH (0.61) and ADBE (1.02).
        stretchedAtr: 0.8,
        // Unusual volume in the first candle, in place of the race's pre-market volume factor: the 09:30 candle's
        // volume ÷ the same candle's average over the race's relativeVolume.days sessions, factor = ratio ^ exponent
        // kept between minFactor and maxFactor → ½× normal 0.81, normal 1, 2× 1.23, 2.4× or more 1.3. At most ±25-30%,
        // so the distance from the 20 SMA (1 down to 0.02) still decides: on Oct 15 it only swapped UNH (1.9×) over
        // ABNB (1.5×), and WMT at 4.3× stayed last.
        volume: {
            exponent: 0.3,
            minFactor: 0.8,
            maxFactor: 1.3,
        },
    },

    // "Shine" (the trader's red-day alert, Oct 24): off until the trader switches it on from the board's header, on days
    // the whole market opens red. Then every stock is watched, on or off the board. On the 5-minute chart (24-hour, like
    // his broker's), a stock that lost the 200 SMA (opened under it, or a candle since the bell closed under it) and
    // then closes a candle above both the 200 SMA and the fast SMA is turning from red to green: alert, once a day.
    // Checked against his charts: green = 5 SMA, red = 10 SMA, orange = 200 SMA over every 5-minute candle including the
    // overnight session (MU Oct 20 10:05: 5 → 898.355, 10 → 892.654, 200 → 891.00, chart 898.355 / 892.654 / 890.991).
    //   MU Oct 20: opened 884.13 under the 200 (891.36); 09:45 closed 892.05 over the 200 (891.12) and the 10 (888.36).
    //   PANW Oct 23: 09:35 closed 352.31 under both; 09:40 closed 355.47 over the 10 (354.57) and our 200 (353.20).
    //   The trader's chart has PANW's 200 slightly over 355.47 (it fired at 09:45 there): his provider's thin
    //   pre-market and overnight candles differ from Alpaca's (its 50 and 200 SMAs, and volume, don't match ours there).
    shine: {
        // Development: in a replay it is on by itself (no time to press the button); the button still switches it off.
        autoOnInSimulation: true,
        // Alerts only from candles that start within this long after the bell: later is too late.
        windowMinutes: 90,
        // The opening chop doesn't count: no alert from a candle starting in the first this-many minutes (10 = from the
        // third candle, 09:40). A stock that wins the SMAs back in them must lose the 200 SMA again and win it back later.
        ignoreFirstMinutes: 10,
        // Lost = opened or closed at least this far under the 200 SMA, in daily ATRs (a third of a normal candle).
        // Closer is sitting on the line: the trader's chart provider has slightly different pre-market and overnight
        // candles, so its 200 SMA can sit a few cents off ours. DKNG Oct 23: closed 20.75 under our 20.777 (0.028 ATR),
        // never under on his chart (his 200 SMA 20.70 at 08:00, ours 20.77): out. PANW closed 0.047 ATR under: kept.
        minLossAtr: 0.04,
        // The trader's filters (Oct 24). A candle that wins the SMAs back but fails one takes the stock out for the day:
        // no alert, nothing later. Calibrated on the Oct 23 full list (61 alerts before them; scripts/shine-study.ts).
        // Volume: the candle's volume against the same candle on recent days, at least this (quieter = no buyers).
        // The trader's 0.7 cut more good alerts than bad on both test days: Oct 20 the 31 stocks under 0.7× did better
        // than the 23 kept (median best next hour +0.42 vs +0.38 ATR; UAL 0.62× +1.43, DAL 0.49× +1.34, MU 0.68× +0.55),
        // Oct 23 it cut S (0.60×, +0.64). Lowered to 0.6 (Oct 24); volume still orders alerts of the same candle.
        minCandleVolume: 0.6,
        // Tight (stayed close to the 200 SMA): since the bell the low went at most this far under it, in daily ATRs.
        // The four best of Oct 23 went 0.11–0.36 under (PANW, CRWD, FTNT, S: +0.64 to +1.08 ATR the next hour);
        // MRNA went 0.63 under in its big first 15 minutes (loose, +0.26). Also out at 0.45: PLTR, NVDA, MMM, META,
        // TWLO, CSCO (all +0.14 ATR or less).
        maxDipAtr: 0.45,
        // Slow (crept back, no jump): the winning candle's high to low at most this, in daily ATRs (a normal candle is
        // 0.11). The four best: 0.24–0.35; out: MRNA 0.40, MMM 0.42.
        maxTriggerRangeAtr: 0.38,
        // Not in a clear, steady slide: out when the hourly 20 SMA (24-hour chart, the alert candle's close as the
        // hour's close) fell at least slideDropAtr daily ATRs over the last slideHours hours AND fell in at least
        // slideFallingHours of the last slideRecentHours hourly steps. A few hours of easing is not a slide (PANW
        // Oct 23: +0.33 ATR, 4 of 15 falling); ORCL Oct 22 is (−0.79, 15 of 15). Oct 20–23, 85 alerts: also out SMCI
        // Oct 22 (−0.85, failed), MSFT (−0.84, rose 0.45), SPCX and AMKR Oct 23 (about flat); kept BABA, COIN, CBRS Oct 20
        // (−0.62 to −0.70, all rose): the steep ones were a mixed lot, so the bar only takes out the most drastic.
        slideHours: 20,
        slideDropAtr: 0.75,
        slideRecentHours: 15,
        slideFallingHours: 13,
        // The trend line it must lose and win back, and the fast line it must also close above (the chart's red line).
        slowSmaPeriod: 200,
        fastSmaPeriod: 10,
        // History loaded when it is switched on: the last closes before today's 04:00, from this many calendar days
        // (a Tuesday after a Monday holiday still reaches Friday).
        priorCloses: 250,
        priorCalendarDays: 6,
    },

    smaReclaim: {
        // The hourly candles watched, by their start hour in New York. 09 = 09:00–10:00, whose last half is the first
        // half hour of the session: nothing triggers before 10:00. 10 = the second hour; both may trigger.
        hours: ['09', '10'],
        // "Get ready" once this many minutes of the hour have closed (55 = at hh:55, 25 minutes after the bell for the
        // first hour), if the candle dipped under the SMA and is back above it.
        prepareAtMinute: 55,
        // The SMA must point up: its rise over the race's lookback (10 hours), in daily ATRs. 0.1 is where the
        // score's angle factor calls it rising (META Oct 9 at +0.06 was flat on the trader's chart).
        minSlopeAtr: 0.1,
        // Yesterday's angle of the hourly 20 SMA must not be under RaceRulesConfig.minPriorSmaSlopeAtr, the race's own
        // rule (ECHO Oct 9, a perfect cross that fell); only opening above the daily upper Bollinger band skips it.
        // The candle, in daily ATRs (the trader: close above the SMA and close to it; a hammer or a cross, where the
        // body sits does not matter): the low went at least `minDipAtr` under the SMA (a real test, not a tick through) ...
        minDipAtr: 0.1,
        // ... and the close is at most `maxCloseAboveAtr` above it (still close to it: further up it has run away and
        // may come back down).
        maxCloseAboveAtr: 0.4,
        // The fight (the trader: a hammer or a cross shows the struggle; a small green candle may just as well stay
        // put): the hour moved at least `minRangeAtr` from high to low ...
        minRangeAtr: 0.4,
        // ... and its body (open to close) is at most this share of that range, the rest wicks. 0.55, not 0.5, so a
        // borderline hammer passes (ABNB Oct 9: 51%, +0.8% two hours later).
        maxBodyShare: 0.55,
        // Oct 9 full run, 16 reclaims. Kept: AFRM (hammer, body 22%), GME (46%), PLTR 10:00 (cross, +2.4%), ABNB
        // (51%), GM (cross, flat) and ECHO (cross, −1.3%). Dropped: PYPL (0.32 ATR range, +0.6%), IOT and NOW (dipped
        // 0.00–0.08 ATR), UBER (0.81 ATR above, dip 0.10), PINS (0.97) and SNOW (0.68) ran away from the SMA.

        // Score (ranks the 20 SMA section of the Alerts tab and picks the popups; not back-tested):
        //   100 × angle (the race's factor) × dip × closeness × volume (the shared factor above)
        //   dip = ½ + ½ × min(1, dip ÷ fullDipAtr): the minimum 0.1 ATR → 0.67, 0.3 ATR or deeper → 1.
        //   closeness = 1 − closenessWeight × close above ÷ maxCloseAboveAtr: on the SMA 1, at the limit 0.7.
        // "No setup" closes are rated the same way (closeness floored at minFactor) so every stock ranks. A stock that
        // does it in both hours adds both scores, so it climbs the list.
        score: {
            fullDipAtr: 0.3,
            closenessWeight: 0.3,
            minFactor: 0.2,
        },
    },
};
