import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../config/winston.config';

// Stocks the user keeps an eye on across days. Saved outside app/ so writing it doesn't restart nodemon.
const WATCHLIST_FILE = path.join(__dirname, '..', '..', 'data', 'watchlist.json');

export interface IWatchedQuote {
    quote: string;
    addedAt: string;
}

let watchlist: IWatchedQuote[] = load();

function load(): IWatchedQuote[] {
    try {
        const stored = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
        return Array.isArray(stored) ? stored : [];
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            logger.error(`watchlist could not be read, starting empty: ${err}`);
        }
        return [];
    }
}

const save = () => {
    fs.mkdirSync(path.dirname(WATCHLIST_FILE), { recursive: true });
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2));
};

export const getWatchlist = (): IWatchedQuote[] => watchlist;

export const getWatchedQuotes = (): string[] => watchlist.map((watched) => watched.quote);

export const isWatched = (quote: string): boolean => watchlist.some((watched) => watched.quote === quote);

export const watch = (quote: string): IWatchedQuote[] => {
    const symbol = quote.trim().toUpperCase();
    if (symbol && !watchlist.some((watched) => watched.quote === symbol)) {
        watchlist = [...watchlist, { quote: symbol, addedAt: new Date().toISOString() }];
        save();
    }
    return watchlist;
};

export const unwatch = (quote: string): IWatchedQuote[] => {
    const symbol = quote.trim().toUpperCase();
    if (watchlist.some((watched) => watched.quote === symbol)) {
        watchlist = watchlist.filter((watched) => watched.quote !== symbol);
        save();
    }
    return watchlist;
};
