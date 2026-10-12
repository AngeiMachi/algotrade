// Every number the pre-market race rules use. Tune here; the rules themselves live in app/engine/race-rules.
// "Above"/"below" are written for long; short mode mirrors them automatically.
//
// The score (0-100) multiplies four factors, each between 0 and 1, and two penalties when they apply:
//   score = 100 × gapStrength × smaDistance × smaSlope × holdQuality (× underLongSma) (× underSmaNow)
// Distances are measured in daily ATRs, not raw percent, so calm and wild stocks compare fairly:
//   gap      → gap ÷ ATR14
//   distance → (price − SMA20) ÷ ATR14   (Keltner-channel style)
//   slope    → how far the hourly SMA20 climbed over the last hours ÷ ATR14
// The distance deliberately does not use Bollinger σ: after a quiet overnight σ collapses, and a normal
// breakout out of that tight range would look "3σ stretched" when it is really a small move for the stock.

export const RaceRulesConfig = {
    // An hourly close may sit this far through the 20 SMA and still count as holding it.
    smaTolerancePct: 0.05,
    // Only the last this-many hourly candles before the bell are judged (05:00–09:00 for a 09:30 bell), and only hours
    // with trades: an empty hour carries the previous close while the SMA keeps moving (ECHO Oct 5: no trade from
    // Friday 16:00 to Monday 07:40, the rising SMA passed the frozen 93.02 at 05:00 and knocked it out).
    hourlyCloseLookbackHours: 4,
    // Yesterday's angle of the hourly 20 SMA (its change over scoring.smaSlope.lookbackHours at the last hourly candle
    // before today's pre-market, in daily ATRs) under this = out for the day: a stock whose SMA pointed down the day
    // before is a turn, not a trend. The keep rule (above the daily upper BB, a big jump like earnings) overrides it.
    minPriorSmaSlopeAtr: 0,

    // Pre-market dollar volume below this is too thin to trust.
    minPremarketDollarVolume: 200000,

    atrPeriodDays: 14,

    // Stocks averaging fewer shares a day than this (over the last averageVolumeDays sessions) are dropped
    // before the race starts and never appear on the board.
    minAverageDailyVolume: 3000000,
    averageVolumeDays: 20,

    // "MA reclaimed" highlight: yesterday opened below this hourly SMA (24-hour candles); today the price (the open,
    // after the bell) is above it. Both sides must hold with empty hours filled and with traded hours only.
    reclaim: {
        smaPeriod: 200,
    },

    // Daily trend filters on the board. "Uptrend": today's price (the open, after the bell) is above the fast and the
    // slow daily SMA. "Strong uptrend": also the fast SMA above the slow one. "Downtrend": the price is below both.
    // SMAs use closes before today.
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

    // "Above upper BB" highlight: the price (the open, after the bell) is above the daily upper Bollinger band.
    // The band is drawn the way the daily chart shows it at the open: the last `periodDays − 1` daily closes plus
    // today's price, mean + `stdDevs` population standard deviations.
    bollinger: {
        periodDays: 20,
        stdDevs: 2,
    },

    // "Near high" exception: a healthy stock a hair under yesterday's high stays eligible. In daily ATRs, so a calm
    // and a wild stock get the same allowance.
    nearPreviousExtreme: {
        // Noise: one 5-minute candle typically ranges about ATR ÷ √78 ≈ 0.11 ATR (78 candles in a session,
        // random-walk scaling). Being less than that under the high is not a failure at the high.
        // ATR 2% → 0.2% under, ATR 5% → 0.5%.
        maxShortfallAtr: 0.1,
        // Conviction: at least a quarter of a normal day's move above yesterday's close (ATR 2% → +0.5%), or
        // unusual pre-market volume (RVOL ≥ relativeVolume.trendingAt).
        minGapAtr: 0.25,
        // At most half the noise under the high (ATR 4% → 0.2%) it is at the high: no conviction needed (SHOP Oct 5:
        // on the board all morning, opened 152.78, 0.15% = 0.035 ATR under Friday's 153.01, gap 0.21 ATR, quiet volume).
        atHighAtr: 0.05,
    },

    // ATR used for the SMA distance when a stock has no daily history yet.
    fallbackAtrPct: 3,

    scoring: {
        // The trader (Oct 12): closeness to the 20 SMA matters most, a gap matters (somewhat substantial, not
        // huge), volume is a nice confirmation; far from the SMA is a clear "not first", and big volume there can be
        // a warning. Oct 12 at the open: SHOP (gap 0.43 ATR, 0.26 ATR above the SMA, RVOL 2.4) was the clear
        // winner (+3.7% by the close) but ranked 7th behind CRM, NOW and EBAY, all ~0.66 ATR above the SMA
        // (CRM −1.6%, NOW −3.8%, EBAY flat). With these dials SHOP ranks 1st and those three ~20th.
        //
        // gapStrength = g² ÷ (g² + halfAtr²), g = gap in daily ATRs (a Hill curve: an S that saturates).
        // With halfAtr 0.25: 0.1 ATR → 0.14, 0.2 → 0.39, 0.25 → 0.5, 0.35 → 0.66, 0.5 → 0.8, 1 → 0.94.
        // A tiny gap is nearly worthless, a quarter of a day's move is half marks, and past ~0.5 ATR more gap adds
        // little: a 1 ATR gap beats a 0.43 ATR one by only 1.25×, which closeness easily outweighs.
        gap: {
            halfAtr: 0.25,
        },
        // smaDistance = 1 within comfortAtr of the SMA; beyond it decays like a normal tail:
        //   exp(−½ × ((distance − comfortAtr) ÷ decayAtr)²)
        //   → 0.15 ATR: 1, 0.26: 0.93, 0.35: 0.80, 0.45: 0.61, 0.55 (stretched): 0.41, 0.66: 0.24, 1 ATR: 0.02.
        // comfortAtr ≈ the noise of one or two 5-minute candles (one is ATR ÷ √78 ≈ 0.11 ATR).
        smaDistance: {
            comfortAtr: 0.15,
            decayAtr: 0.3,
        },
        // volume = RVOL ^ (exponent × (2 × smaDistance − 1)), RVOL (pre-market, `relativeVolume`) kept between
        // minRvol and maxRvol. The sign follows closeness: near the SMA (smaDistance ≈ 1) busy volume confirms and
        // quiet volume costs; past the midpoint (smaDistance < 0.5, ≈ 0.5 ATR away) busy volume is a warning
        // (buying climax) and quiet volume is not rewarded (RVOL under 1 counts as 1 there).
        //   On the SMA: RVOL 4+ → 1.32, 2.4 → 1.19, 1 → 1, 0.5 → 0.87, 0.25 or less → 0.76.
        //   0.66 ATR away (smaDistance 0.24): RVOL 4+ (CRM 6×) → 0.86, 1 or less → 1.
        // No RVOL yet (no history, or before relativeVolume.fromTime): 1.
        volume: {
            exponent: 0.2,
            minRvol: 0.25,
            maxRvol: 4,
        },
        // smaSlope: which way the hourly 20 SMA points going into the open, from completed hourly candles only.
        //   slope = (SMA now − SMA lookbackHours ago) ÷ ATR14, in daily ATRs.
        // Over 10 hours the SMA's change compares the last 10 hourly closes with those 20-30 hours back, so it
        // reads the angle from the day before into the pre-market. 5 hours is too short to tell rising from noise;
        // 20 hours lets yesterday's dip hide a turn up (TSLA Oct 9: 20h +0.12, 10h +0.24).
        //   smaSlope = floor + (1 − floor) × ½(1 + tanh((slope − midpointAtr) ÷ widthAtr))
        //   → rising 0.3 ATR or more: ~1, 0.2: 0.91, 0.1 (barely rising): 0.63, flat: 0.34, falling: 0.25.
        // Oct 9 at 09:00, against the trader's charts: AFRM +0.51 (1.00), SNOW +0.36 (1.00), TSLA +0.24 (0.96)
        // point up; META +0.06 (0.48) is flat.
        smaSlope: {
            lookbackHours: 10,
            midpointAtr: 0.1,
            widthAtr: 0.1,
            floor: 0.25,
        },
        // Applied when the price (the open, after the bell) is under the hourly 200 SMA (reclaim.smaPeriod) in both
        // readings. It outweighs the angle: a gently rising 20 SMA above the 200 (0.1 ATR → smaSlope 0.63) beats a
        // steep one under it (smaSlope 1 × 0.5). A flat 20 SMA (0.34) still ranks below a steep one under the 200.
        underLongSma: {
            factor: 0.5,
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
