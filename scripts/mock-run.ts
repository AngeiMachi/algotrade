import 'dotenv/config';
import * as globalConfig from '../app/config/globals.config';

// usage: npx ts-node scripts/mock-run.ts [YYYY-MM-DD] [seconds per candle] [New York start time HH:mm]
globalConfig.Mock.IsMock = true;
globalConfig.Mock.MockDataDate = process.argv[2] || '2026-10-08';
globalConfig.Mock.startAtOpen = false;
globalConfig.Mock.MockDataLiveSimulationTime = `${process.argv[4] || '07:30'}:00`;
globalConfig.Mock.intervalLapTime = `*/${process.argv[3] || 10} * * * * *`;
globalConfig.Notifications.usePush = false;

const app = require('../app/engine/app').default;
app();
