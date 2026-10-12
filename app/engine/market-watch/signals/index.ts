import { IWatchSignal } from '../market-watch.types';
import { smaReclaim } from './sma-reclaim';
import { upperBandTouch } from './upper-band-touch';

// Every market-watch signal, in the order the board lists their groups. To add one: write its file, add it here.
export const watchSignals: IWatchSignal[] = [smaReclaim, upperBandTouch];
