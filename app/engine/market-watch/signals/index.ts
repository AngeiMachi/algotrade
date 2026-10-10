// The market watch's signals. To add one: write it in its own file here (see market-watch.types for the shape)
// and add it to this list. Its describe() text shows in the board's rule book.
import { IWatchSignal } from '../market-watch.types';
import { upperBandTouch } from './upper-band-touch';

export const watchSignals: IWatchSignal[] = [upperBandTouch];
