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
    },
};
