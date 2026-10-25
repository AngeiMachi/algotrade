import { IWatchSignal } from '../market-watch.types';
import { firstCandle } from './first-candle';
import { shine } from './shine';
import { smaReclaim } from './sma-reclaim';
import { upperBandTouch } from './upper-band-touch';

// Every market-watch signal, in the order the board lists their groups. To add one: write its file, add it here.
export const watchSignals: IWatchSignal[] = [shine, firstCandle, smaReclaim, upperBandTouch];
