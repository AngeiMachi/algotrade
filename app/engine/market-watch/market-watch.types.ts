import { IDailySmas } from '../race-rules/race-facts';
import { IPremarketVolumeDay } from '../race-rules/race-rule.types';

// The market watch follows the race's stocks through the regular session and raises alerts.
// Each signal is a small object in ./signals: it says which stocks it watches and finds its events in the day's bars.
// Signals are pure: given the bars so far they return every event of the day, so a restart or a replay rebuilds the
// same alerts, and an alert never depends on when the engine happened to look.

// A 5-minute candle. `forming` = it has not closed yet (live refresh only).
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
    low: number;
    close: number;
    complete: boolean; // the hour has ended on the data clock
    traded: boolean; // false for an hour without trades, filled with the previous close
}

// Everything a signal may read about one stock. No judgement happens here.
export interface IWatchFacts {
    quote: string;
    tradeDate: string;
    atrPct: number; // daily ATR14 as a percent of the price
    priorDailyCloses: number[]; // daily closes before today, oldest first
    dailySmas: IDailySmas | null; // the race's daily trend SMAs (closes before today)
    priorHourlyCloses: number[]; // 24-hour hourly closes before today's pre-market, oldest first
    volumeHistory: IPremarketVolumeDay[]; // recent sessions' 5-minute volume from 04:00 to the close
    hours: IWatchHour[]; // today's hourly candles so far
    allBars: IWatchBar[]; // today's 5-minute candles from 04:00, any session, oldest first
    openingPrice: number | null; // first regular-session candle's open
    bars: IWatchBar[]; // today's regular-session candles so far, oldest first
    onBoard: boolean; // in the race's standings (after the bell: the final board)
}

// opportunity = a buy setup, prepare = a buy setup may complete in minutes, caution = avoid buying here,
// info = wait, no call yet.
export type AlertTone = 'opportunity' | 'prepare' | 'caution' | 'info';

export interface IMarketAlert {
    id: string; // stable: the same event stage always gets the same id
    signal: string; // the signal's id: the alert's group on the board
    eventId: string; // the stages of one event share it (a touch and its hold; a reclaim forming and closing)
    stage: string; // a word or two for this stage, e.g. "Touched", "Held", "Forming", "Closed above"
    quote: string;
    tone: AlertTone;
    title: string; // a few words, e.g. "Fast drop to the upper BB"
    summary: string; // the call in one short line: why it is (or is not) a buy
    message: string; // what happened, with the numbers that matter
    details: string[]; // the measurements behind the call, one per line
    candle: string; // 'HH:mm' New York, the candle the event happened in
    timeIso: string; // start of that candle
    price: number; // the price the event happened at
    // Buy setups (and a "Get ready" that may become one) are rated like the race: 100 × factors between 0 and 1.
    score?: number;
    scoreParts?: IAlertScorePart[];
    // Facts that help decide beyond the score (volume, stop size, room to the high...), shown as badges.
    badges?: IAlertBadge[];
}

export interface IAlertBadge {
    id: string; // the board's badge key (its color, icon and explanation)
    label: string;
    detail: string; // this stock's numbers
}

export interface IAlertScorePart {
    label: string;
    factor: number;
    note: string;
}

// What a signal reports about a stock it is watching right now (shown on the Alerts tab).
export interface IWatchStatus {
    quote: string;
    signal: string;
    state: string; // a word or two, e.g. "Armed" or "Touched 1×"
    note: string; // e.g. "0.42 ATR above the BB (213.10)"
}

export interface IWatchSignal {
    id: string;
    title: string;
    shortTitle: string; // the group's name on the board, e.g. "BB touch"
    describe: () => string; // plain language, shown in the board's rule book
    watches: (facts: IWatchFacts) => boolean; // is this stock part of the signal today?
    detect: (facts: IWatchFacts) => IMarketAlert[]; // every event of the day so far
    status: (facts: IWatchFacts) => IWatchStatus | null;
}
