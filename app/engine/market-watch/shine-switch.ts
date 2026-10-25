import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../../config/winston.config';

// The trader's "Shine alert" switch on the board's header, for one trade date. Saved outside app/ so writing it
// doesn't restart nodemon, and a restart during the session keeps it on (or off).
const SHINE_FILE = path.join(__dirname, '..', '..', '..', 'data', 'shine.json');

export interface IShineSwitch {
    tradeDate: string;
    on: boolean;
    since: string | null; // ISO time it was switched on (data clock)
}

let stored: IShineSwitch | null = load();

function load(): IShineSwitch | null {
    try {
        const value = JSON.parse(fs.readFileSync(SHINE_FILE, 'utf8'));
        return value && typeof value.tradeDate === 'string' ? { on: true, since: null, ...value } : null;
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            logger.error(`shine switch could not be read, starting off: ${err}`);
        }
        return null;
    }
}

const save = () => {
    fs.mkdirSync(path.dirname(SHINE_FILE), { recursive: true });
    fs.writeFileSync(SHINE_FILE, JSON.stringify(stored, null, 2));
};

// The trader's choice for the day; null = he hasn't touched it today.
export const shineSwitch = (tradeDate: string): IShineSwitch | null => (stored?.tradeDate === tradeDate ? stored : null);

export const setShine = (tradeDate: string, on: boolean, nowIso: string) => {
    stored = { tradeDate, on, since: on ? (shineSwitch(tradeDate)?.since ?? nowIso) : null };
    save();
};
