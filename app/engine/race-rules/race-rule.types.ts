export type RaceDirection = 'long' | 'short';

// All percentages are "directional": positive means the good side for the chosen direction
// (above for long, below for short), so rules never have to branch on direction.
export interface IHourlyCandleFacts {
    hour: string; // "08" for the 08:00-09:00 New York candle
    close: number;
    sma: number;
    complete: boolean;
    closeVsSmaPct: number;
    wickVsSmaPct: number; // the wick on the SMA side: low for long, high for short
}

export interface IPremarketVolumeDay {
    date: string; // New York 'YYYY-MM-DD'
    bars: { time: string; volume: number }[]; // 5-minute pre-market bars, 'HH:mm' New York, sorted
}

export interface IRaceFacts {
    quote: string;
    direction: RaceDirection;
    isAfterBell: boolean;
    bellTime: string; // "09:30"

    previousClose: number;
    previousExtreme: number | null; // yesterday's high for long, low for short
    previousExtremeCushionPct: number | null; // price vs that level
    price: number;
    gapPct: number;
    gapInAtr: number; // gap measured in daily ATRs, so a 3% gap on a calm stock outweighs 3% on a wild one
    atrPct: number;
    premarketVolume: number;
    premarketDollarVolume: number;
    averagePremarketVolume: number | null; // recent sessions' average volume from 04:00 to the same candle
    relativeVolume: number | null; // premarketVolume ÷ averagePremarketVolume (RVOL)
    lastCandle: string; // "09:20"

    sma: number;
    smaCushionPct: number;
    smaStretchAtr: number; // distance from the 20 SMA in daily ATRs (Keltner-style units)
    hourlyCandles: IHourlyCandleFacts[];
    smaTouches: number;

    reclaimSma: number | null; // hourly SMA used by the reclaim highlight (200 by default)
    reclaimSmaCushionPct: number | null; // price (the open, after the bell) vs that SMA
    reclaimedYesterday: { openedAt: number; smaAtOpen: number; reachedAtHour: string } | null;

    openingPrice: number | null; // first regular-session bar's open, once the bell rang
    openingGapPct: number | null; // first regular-session bar's open vs yesterday's close, once the bell rang
    openingVsPreviousExtremePct: number | null; // that open vs yesterday's high (long) / low (short)
}

export interface IElimination {
    time: string;
    reason: string;
}

// caution = worth a look, alert = serious but still racing, danger = marks the stock at risk.
export interface IRaceWarning {
    id: string;
    level: 'caution' | 'alert' | 'danger';
    label: string; // a word or two for badges, e.g. "Stretched"
    message: string;
}

export interface IScoreFactor {
    rule: string;
    factor: number; // 0..1
    note: string;
}

interface IRaceRule {
    id: string;
    title: string;
    describe: () => string;
}

// Permanent: once a stock is eliminated it stays out for the rest of the day.
export interface IEliminationRule extends IRaceRule {
    check: (facts: IRaceFacts) => IElimination | null;
}

// Temporary: a stock that fails a qualification rule can come back on a later candle.
// listedAs decides where it waits: 'out' (Out for today) or 'waiting' (Not qualifying).
export interface IQualificationRule extends IRaceRule {
    listedAs: 'out' | 'waiting';
    check: (facts: IRaceFacts) => string | null;
}

// Returns a factor between 0 and 1. Score = 100 × the product of all factors, so one bad trait
// (e.g. badly stretched) drags the score down no matter how strong the others are.
export interface IScoringRule extends IRaceRule {
    factor: (facts: IRaceFacts) => { factor: number; note: string };
}

// Flags something the trader should look at. A "danger" warning marks the stock at risk.
export interface IWarningRule extends IRaceRule {
    check: (facts: IRaceFacts) => IRaceWarning | null;
}

// Something good worth pointing out. Highlights do not change the score.
export interface IRaceHighlight {
    id: string;
    label: string;
    message: string;
}

export interface IHighlightRule extends IRaceRule {
    check: (facts: IRaceFacts) => IRaceHighlight | null;
}

export interface IRuleDescription {
    kind: 'elimination' | 'qualification' | 'scoring' | 'warning' | 'highlight';
    title: string;
    description: string;
}
