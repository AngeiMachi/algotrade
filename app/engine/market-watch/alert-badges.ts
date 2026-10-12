import * as _ from 'lodash';

import { MarketWatchConfig } from '../../config/market-watch.config';
import { RaceRulesConfig } from '../../config/race-rules.config';
import { volumeNow } from './alert-score';
import { IAlertBadge, IWatchFacts } from './market-watch.types';

// Badges on a setup that help the trader decide when the score alone is not enough: how busy the stock is, how far
// the stop is, whether there is room up to the day's high. Thresholds in MarketWatchConfig.badges.

export interface ISetupContext {
    price: number; // the buy
    stop: number; // where the setup is wrong
    until: string; // 'HH:mm', the candle the setup was read at
    slopeAtr: number | null; // angle of the hourly 20 SMA, daily ATRs
    dipAtr?: number; // how far under the SMA it went (reclaim)
}

const settings = () => MarketWatchConfig.badges;
const formatAtr = (atr: number) => `${atr.toFixed(2)} ATR`;

export const decisionBadges = (facts: IWatchFacts, setup: ISetupContext): IAlertBadge[] => {
    const config = settings();
    const atr = ((facts.atrPct > 0 ? facts.atrPct : RaceRulesConfig.fallbackAtrPct) / 100) * setup.price;
    const badges: IAlertBadge[] = [];

    if (facts.onBoard) {
        badges.push({ id: 'on-board', label: 'On the board', detail: "In the race's final standings at the bell" });
    }

    if (setup.slopeAtr !== null && setup.slopeAtr >= config.steepSlopeAtr) {
        badges.push({ id: 'steep-sma', label: 'Steep 20 SMA', detail: `Rising ${formatAtr(setup.slopeAtr)} over ${RaceRulesConfig.scoring.smaSlope.lookbackHours} hours` });
    }

    if (setup.dipAtr !== undefined && setup.dipAtr >= config.deepDipAtr) {
        badges.push({ id: 'deep-test', label: 'Deep test', detail: `Went ${formatAtr(setup.dipAtr)} under the SMA and was bought back` });
    }

    const riskAtr = (setup.price - setup.stop) / atr;
    const riskText = `Stop ${setup.stop.toFixed(2)}: ${formatAtr(riskAtr)} (${(((setup.price - setup.stop) / setup.price) * 100).toFixed(1)}%) under the buy`;
    if (riskAtr <= config.tightStopAtr) {
        badges.push({ id: 'tight-stop', label: 'Tight stop', detail: riskText });
    } else if (riskAtr >= config.wideStopAtr) {
        badges.push({ id: 'wide-stop', label: 'Wide stop', detail: riskText });
    }

    const dayHigh = _.max(facts.allBars.filter((bar) => bar.time <= setup.until).map((bar) => bar.high));
    if (dayHigh !== undefined && (dayHigh - setup.price) / atr >= config.roomToHighAtr) {
        badges.push({
            id: 'room-to-high',
            label: 'Room to the high',
            detail: `Today's high ${dayHigh.toFixed(2)} is ${formatAtr((dayHigh - setup.price) / atr)} (+${(((dayHigh - setup.price) / setup.price) * 100).toFixed(1)}%) above`,
        });
    }
    return badges;
};

const TREND_ARROWS = { rising: '↑', steady: '→', fading: '↓' };

// The stock's live volume badge (not stamped on an alert, it follows the session): busy, normal or quiet against a
// normal day, with the trend of the last half hour.
export const volumeBadge = (facts: IWatchFacts): IAlertBadge | null => {
    const volume = volumeNow(facts);
    if (!volume) {
        return null;
    }
    const { rvol, pace, trend, until } = volume;
    const config = settings();
    const id = rvol >= config.busyVolume ? 'trending-volume' : rvol < config.quietVolume ? 'quiet-volume' : 'volume';
    const window = MarketWatchConfig.volume.trendWindowMinutes;
    return {
        id,
        label: `Volume ${rvol.toFixed(1)}×${trend ? ` ${TREND_ARROWS[trend]} ${trend}` : ''}`,
        detail:
            `${rvol.toFixed(1)}× a normal day's volume by ${until}.` +
            (pace !== null ? ` Last ${window} min: ${pace.toFixed(1)}× normal for those minutes${trend ? `, ${trend} against the ${window} min before` : ''}.` : ''),
    };
};
