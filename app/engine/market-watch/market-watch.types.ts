// The market watch follows the race's stocks through the regular session and raises alerts.
// Each signal is a small object in ./signals: it says which stocks it watches and finds its events in the day's bars.
// Signals are pure: given the bars so far they return every event of the day, so a restart or a replay rebuilds the
// same alerts, and an alert never depends on when the engine happened to look.

// A regular-session 5-minute candle. `forming` = it has not closed yet (live refresh only).
export interface IWatchBar {
    key: string; // New York 'YYYY-MM-DD HH:mm:ss', candle start
    time: string; // 'HH:mm'
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    forming: boolean;
}

// Today's 24-hour-chart hourly candle (from 04:00). Hours without trades carry the previous close.
export interface IWatchHour {
    hour: string; // 'HH' New York
    close: number;
    complete: boolean; // the hour has ended on the data clock
}

// Everything a signal may read about one stock. No judgement happens here.
export interface IWatchFacts {
    quote: string;
    tradeDate: string;
    atrPct: number; // daily ATR14 as a percent of the price
    priorDailyCloses: number[]; // daily closes before today, oldest first
    priorHourlyCloses: number[]; // 24-hour hourly closes before today's pre-market, oldest first
    hours: IWatchHour[]; // today's hourly candles so far
    openingPrice: number | null; // first regular-session candle's open
    bars: IWatchBar[]; // today's regular-session candles so far, oldest first
}

// opportunity = a buy setup, caution = avoid buying here, info = no edge either way.
export type AlertTone = 'opportunity' | 'caution' | 'info';

export interface IMarketAlert {
    id: string; // stable: the same event always gets the same id
    signal: string; // the signal's id
    quote: string;
    tone: AlertTone;
    title: string; // a few words, e.g. "Fast drop to the upper BB"
    summary: string; // the call in one short line: why it is (or is not) a buy
    message: string; // what happened, with the numbers that matter
    details: string[]; // the measurements behind the call, one per line
    candle: string; // 'HH:mm' New York, the candle the event happened in
    timeIso: string; // start of that candle
    price: number; // the price the event happened at
}

// What a signal reports about a stock it is watching right now (shown in the notification center).
export interface IWatchStatus {
    quote: string;
    signal: string;
    state: string; // a word or two, e.g. "Armed" or "Touched — waiting to re-arm"
    note: string; // e.g. "0.42 ATR above the upper BB (213.10)"
}

export interface IWatchSignal {
    id: string;
    title: string;
    describe: () => string; // plain language, shown in the board's rule book
    watches: (facts: IWatchFacts) => boolean; // is this stock part of the signal today?
    detect: (facts: IWatchFacts) => IMarketAlert[]; // every event of the day so far
    status: (facts: IWatchFacts) => IWatchStatus | null;
}
