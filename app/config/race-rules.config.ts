// Every number the pre-market race rules use. Tune here; the rules themselves live in app/engine/race-rules.
// "Above"/"below" are written for long; short mode mirrors them automatically.
//
// The score (0-100) multiplies three factors, each between 0 and 1:
//   score = 100 × gapStrength × smaDistance × holdQuality (× underSmaNow when it applies)
// Distances are measured in daily ATRs, not raw percent, so calm and wild stocks compare fairly:
//   gap      → gap ÷ ATR14
//   distance → (price − SMA20) ÷ ATR14   (Keltner-channel style)
// The distance deliberately does not use Bollinger σ: after a quiet overnight σ collapses, and a normal
// breakout out of that tight range would look "3σ stretched" when it is really a small move for the stock.

export const RaceRulesConfig = {
    // An hourly close may sit this far through the 20 SMA and still count as holding it.
    smaTolerancePct: 0.05,

    // Pre-market dollar volume below this is too thin to trust.
    minPremarketDollarVolume: 200000,

    atrPeriodDays: 14,

    // Stocks averaging fewer shares a day than this (over the last averageVolumeDays sessions) are dropped
    // before the race starts and never appear on the board.
    minAverageDailyVolume: 3000000,
    averageVolumeDays: 20,

    // "MA reclaimed" highlight: yesterday opened below this hourly SMA (24-hour candles) and climbed to it during
    // the regular session; today the price (the open, after the bell) is above it.
    reclaim: {
        smaPeriod: 200,
    },

    // "Uptrend" filter on the board: the fast daily SMA is above the slow one, or today's price (the open, after the bell)
    // is above the slow one. SMAs use closes before today.
    trend: {
        fastSmaDays: 10,
        slowSmaDays: 20,
    },

    // "Trending volume" highlight: pre-market volume so far vs the average of the last `days` sessions up to the
    // same 5-minute candle (RVOL). Before `fromTime` the early-morning numbers are too small to mean much.
    relativeVolume: {
        days: 10,
        // 1.5 so a heavily traded stock having a busy morning counts (ALAB Oct 6: 1.6×); the gap rule keeps it selective.
        trendingAt: 1.5,
        fromTime: '05:00',
    },

    // ATR used for the SMA distance when a stock has no daily history yet.
    fallbackAtrPct: 3,

    scoring: {
        // gapStrength = tanh(gapInAtr ÷ scaleAtr): rises quickly at first, then flattens.
        // With scaleAtr 1: 0.25 ATR → 0.24, 0.5 → 0.46, 1 → 0.76, 2 → 0.96. Bigger gaps add little,
        // because large gap-ups fade more often in the first hour.
        gap: {
            scaleAtr: 1,
        },
        // smaDistance = 1 within comfortAtr of the SMA; beyond it decays like a normal tail:
        //   exp(−½ × ((distance − comfortAtr) ÷ decayAtr)²)
        //   → 0.5 ATR: 1, 0.75: 0.88, 1 ATR: 0.61, 1.5: 0.14, 2: 0.01 (with comfortAtr 0.5, decayAtr 0.5).
        // Example: ATR 3%, 4.5% above the SMA = 1.5 ATR → keeps 14%. ATR 6%, 2.9% above = 0.48 ATR → full marks.
        smaDistance: {
            comfortAtr: 0.5,
            decayAtr: 0.5,
        },
        // holdQuality = touchFactor ^ (hourly wicks that dipped below the SMA). Clean = 1.
        hold: {
            touchFactor: 0.85,
        },
        // Applied while the price is under the SMA right now (its hourly candle has not closed yet).
        underSmaNow: {
            factor: 0.5,
        },
    },

    warnings: {
        // Distance from the 20 SMA, in daily ATRs, that triggers the "stretched" warnings.
        // Calibrated on the trader's calls: ALAB Oct 6 at 0.48 ATR was "not extended";
        // XOM 0.61, OXY 0.64 and PLTR 0.74 on Oct 8 were.
        stretchedAtr: 0.55,
        extremeAtr: 1,
    },
};
