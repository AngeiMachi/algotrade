import { RaceDirection } from './race-rule.types';

// Direction-aware wording so rule messages read naturally in both long and short mode.
export const raceWords = (direction: RaceDirection) =>
    direction === 'long'
        ? { goodSide: 'above', badSide: 'below', previousExtreme: "yesterday's high" }
        : { goodSide: 'below', badSide: 'above', previousExtreme: "yesterday's low" };

export const formatPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
