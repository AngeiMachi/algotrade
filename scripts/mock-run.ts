import 'dotenv/config';
import * as globalConfig from '../app/config/globals.config';

// usage: npx ts-node scripts/mock-run.ts [YYYY-MM-DD] [seconds per candle] [New York start time HH:mm] [quotes]
// quotes: a list name from QuotesConfig ('development', 'producion'), or tickers like TSLA,AFRM,SNOW.
// Defaults to ActiveQuotesList in globals.config (the short development list while developing).
const quotesArg = process.argv[5] || globalConfig.ActiveQuotesList;
if (quotesArg.includes(',')) {
    (globalConfig.QuotesConfig as Record<string, unknown>).replay = {
        indexes: { behaviors: [], signals: [], names: ['SPY'] }, // SPY drives the replay clock
        replay: { behaviors: [], signals: [], names: quotesArg.toUpperCase().split(',') },
    };
}
(globalConfig as { ActiveQuotesList: string }).ActiveQuotesList = quotesArg.includes(',') ? 'replay' : quotesArg;
globalConfig.Mock.IsMock = true;
globalConfig.Mock.MockDataDate = process.argv[2] || '2026-10-08';
globalConfig.Mock.startAtOpen = false;
globalConfig.Mock.MockDataLiveSimulationTime = `${process.argv[4] || '08:30'}:00`;
globalConfig.Mock.intervalLapTime = `*/${process.argv[3] || 3} * * * * *`;
globalConfig.Notifications.usePush = false;

const app = require('../app/engine/app').default;
app();
