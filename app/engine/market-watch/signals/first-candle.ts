import * as _ from 'lodash';
import moment from 'moment-timezone';

import * as globalConfig from '../../../config/globals.config';
import { MarketWatchConfig } from '../../../config/market-watch.config';
import { RaceRulesConfig } from '../../../config/race-rules.config';
import { scoreRacer } from '../../race-rules';
import { IRaceFacts } from '../../race-rules/race-rule.types';
import { volume } from '../../race-rules/scoring-rules';
import { decisionBadges } from '../alert-badges';
import { candleRelativeVolume, scoreOf } from '../alert-score';
import { healthyPremarket, smaAtHour } from '../hourly-sma';
import { IAlertScorePart, IMarketAlert, IWatchBar, IWatchFacts, IWatchSignal } from '../market-watch.types';

// The trader's opening filter: of the race's healthy board stocks above the hourly 20 SMA, the ones whose first
// 5-minute candle closed green. A red first candle is out for good. Many healthy stocks get smashed in those 5
// minutes; others run so far from the 20 SMA that buying is late. The best went up a little and still have room, so
// the list is ranked by the race's own score with the price moved to the first candle's close: the race's distance
// factor drops a stock that ran away (ADBE Oct 15) under one that stayed close to the SMA (UNH Oct 15).

const NEW_YORK = 'America/New_York';
const settings = () => MarketWatchConfig.firstCandle;
const pct = (from: number, to: number) => ((from - to) / to) * 100;
const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

// On the board, judged on the open, healthy pre-market, and the open above the hourly 20 SMA (a stock kept on the
// board under the SMA, e.g. above the daily upper band, is not part of this).
const eligible = (facts: IWatchFacts): facts is IWatchFacts & { race: IRaceFacts } =>
    facts.onBoard && !!facts.race && facts.race.isAfterBell && healthyPremarket(facts) === true && facts.race.smaCushionPct > 0;

const firstBar = (facts: IWatchFacts): IWatchBar | null => {
    const bar = facts.bars[0];
    return bar && !bar.forming && bar.open === facts.openingPrice ? bar : null;
};

// The race's facts with the price moved to the first candle's close: every price-based number follows it.
const factsAtClose = (facts: IWatchFacts, race: IRaceFacts, close: number): IRaceFacts => {
    const sma = smaAtHour(facts, globalConfig.PremarketRace.smaPeriod, '09', close) ?? race.sma;
    const atrPct = race.atrPct > 0 ? race.atrPct : RaceRulesConfig.fallbackAtrPct;
    const gapPct = pct(close, race.previousClose);
    const smaCushionPct = pct(close, sma);
    return {
        ...race,
        price: close,
        gapPct,
        gapInAtr: race.atrPct > 0 ? gapPct / race.atrPct : 0,
        sma,
        smaCushionPct,
        smaStretchAtr: smaCushionPct / atrPct,
    };
};

// Unusual volume in the first candle, replacing the race's pre-market volume factor.
const firstCandleVolumePart = (facts: IWatchFacts, bar: IWatchBar): IAlertScorePart => {
    const rvol = candleRelativeVolume(facts, bar.time);
    if (rvol === null) {
        return { label: 'First candle volume', factor: 1, note: 'No volume history to compare' };
    }
    const { exponent, minFactor, maxFactor } = settings().volume;
    return {
        label: 'First candle volume',
        factor: _.clamp(rvol ** exponent, minFactor, maxFactor),
        note: `${rvol.toFixed(1)}× a normal first candle (${facts.volumeHistory.length}-day average)`,
    };
};

const alertOf = (facts: IWatchFacts, race: IRaceFacts, bar: IWatchBar): IMarketAlert => {
    const atClose = factsAtClose(facts, race, bar.close);
    const raceParts: IAlertScorePart[] = scoreRacer(atClose)
        .breakdown.filter((line) => line.rule !== volume.title)
        .map((line) => ({ label: line.rule, factor: line.factor, note: line.note }));
    const { score, scoreParts } = scoreOf([...raceParts, firstCandleVolumePart(facts, bar)]);
    const atOpen = scoreRacer(race);
    const atrPct = race.atrPct > 0 ? race.atrPct : RaceRulesConfig.fallbackAtrPct;
    const moveAtr = pct(bar.close, bar.open) / atrPct;
    const stretched = atClose.smaStretchAtr >= settings().stretchedAtr;
    const eventId = `first-candle:${facts.quote}:${facts.tradeDate}`;
    const closedAt = moment.tz(bar.key, 'YYYY-MM-DD HH:mm:ss', NEW_YORK).add(5, 'minutes');
    return {
        id: eventId,
        signal: firstCandle.id,
        eventId,
        stage: 'Green',
        quote: facts.quote,
        tone: stretched ? 'info' : 'opportunity',
        title: stretched ? 'Green first candle, ran from the 20 SMA' : 'Green first candle near the 20 SMA',
        summary: stretched
            ? `Late: ${atClose.smaStretchAtr.toFixed(2)} ATR above the 20 SMA (${atClose.sma.toFixed(2)}) after 5 minutes. Wait for a pullback.`
            : `Up ${signed(moveAtr)} ATR in 5 minutes, ${atClose.smaStretchAtr.toFixed(2)} ATR above the 20 SMA (${atClose.sma.toFixed(2)}): room to go. Stop under ${bar.low.toFixed(2)}.`,
        message: `Opened ${bar.open.toFixed(2)}, first 5-minute candle closed ${bar.close.toFixed(2)} (${signed(pct(bar.close, bar.open))}%).`,
        details: [
            `First candle: ${signed(moveAtr)} ATR, high ${bar.high.toFixed(2)}, low ${bar.low.toFixed(2)}`,
            `Distance from the hourly 20 SMA: ${race.smaStretchAtr.toFixed(2)} ATR at the open, ${atClose.smaStretchAtr.toFixed(2)} ATR at ${closedAt.format('HH:mm')}`,
            `Race score at the open ${atOpen.score}; this alert's score ${score} at ${closedAt.format('HH:mm')}`,
            'Healthy pre-market: no hourly close through the 20 SMA',
        ],
        candle: closedAt.format('HH:mm'),
        timeIso: closedAt.toISOString(),
        price: bar.close,
        score,
        scoreParts,
        badges: decisionBadges(facts, { price: bar.close, stop: bar.low, until: bar.time, slopeAtr: race.smaSlopeAtr }),
    };
};

export const firstCandle: IWatchSignal = {
    id: 'first-candle',
    title: 'Green first candle',
    shortTitle: 'First candle',
    leadsForMinutes: () => settings().leadMinutes,
    describe: () =>
        `At 09:35, the stocks on the race's final board that were healthy pre-market (no hourly close through the 20 SMA) and opened above ` +
        `the hourly 20 SMA, whose first 5-minute candle closed above its open. A red first candle is out for good, and a stock kept on the ` +
        `board under the 20 SMA (e.g. above the daily upper band) is not watched. Ranked by the race's own score with the price moved to ` +
        `that candle's close, so the distance from the 20 SMA decides most: a small rise that left room ranks high, a run away from the SMA ` +
        `ranks low, and ${settings().stretchedAtr} ATR or more above it is a "Wait" instead of a buy setup. The race's pre-market volume ` +
        `factor is replaced by the first candle's volume against a normal first candle (½× → 0.81, 2× → 1.23, at most ` +
        `${settings().volume.maxFactor}): unusual volume lifts a stock, but never past one closer to the SMA by much. ` +
        `Listed first until ${settings().leadMinutes} minutes after the bell, then at the bottom.`,
    watches: eligible,
    detect: (facts) => {
        const bar = eligible(facts) ? firstBar(facts) : null;
        return bar && bar.close > bar.open ? [alertOf(facts, facts.race as IRaceFacts, bar)] : [];
    },
    status: (facts) => {
        if (!eligible(facts)) {
            return null;
        }
        const bar = firstBar(facts);
        const state = !bar ? 'Waiting' : bar.close > bar.open ? 'Green' : 'Out: red first candle';
        return {
            quote: facts.quote,
            signal: firstCandle.id,
            state,
            note: bar
                ? `Open ${bar.open.toFixed(2)} → ${bar.close.toFixed(2)} (${signed(pct(bar.close, bar.open))}%)`
                : `Opened ${facts.race.smaStretchAtr.toFixed(2)} ATR above the 20 SMA (${facts.race.sma.toFixed(2)})`,
        };
    },
};
