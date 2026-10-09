import { RaceDirection } from './race-rule.types';

// Direction-aware wording so rule messages read naturally in both long and short mode.
export const raceWords = (direction: RaceDirection) =>
    direction === 'long'
        ? { goodSide: 'above', badSide: 'below' }
        : { goodSide: 'below', badSide: 'above' };

export const formatPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
