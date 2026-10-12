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
