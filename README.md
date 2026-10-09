# algotrade — Opening Bell Race

Pre-market stock race: ranks the watchlist from 04:00 New York until the bell, using Alpaca market data,
and shows it live in the browser.

- [Strategy, rules and scoring](docs/premarket-race.md)
- [Running, simulation, market data and code map](docs/running-and-data.md)

Quick start:

```
npm run dev                     # engine on :11111 (needs ALPACA_KEY_ID / ALPACA_SECRET_KEY in .env)
cd trade && npm start           # board on http://localhost:3000
npx ts-node scripts/mock-run.ts 2026-10-06 3 07:30   # replay a past day instead of live
```
