import * as _ from 'lodash';
import { QuoteState, QuoteStateSignals } from '../models/state.model';
import { getState } from '../engine/state';
import * as state from '../engine/state';
import express from 'express';
import * as PushAPI from './pushed-api';
import * as quotesIterator from '../engine/quotes-iterator';
import * as premarketRace from '../engine/premarket-race';
import * as watchlist from '../engine/watchlist';
import * as marketWatch from '../engine/market-watch/market-watch';
import * as globalConfig from "../config/globals.config"
import * as mockService from './mock-service';
import * as TwitterAPI from './twitter-api';

const app = express();
const server = require('http').Server(app);
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    //res.setHeader('Access-Control-Allow-Credentials', false);

    // Pass to next layer of middleware
    next();
});

app.get('/getAllQuotes', (req, res) => {
    res.json(getState());
});

app.get('/race', (req, res) => {
    res.json(premarketRace.getSnapshot());
});

app.get('/market-watch', (req, res) => {
    res.json(marketWatch.getState());
});

// Replay control, mock only: pause or play the replay clock.
app.get('/mock', (req, res) => {
    res.json({ isMock: globalConfig.Mock.IsMock, paused: mockService.isPaused() });
});

app.post('/mock', jsonParser, (req, res) => {
    if (!globalConfig.Mock.IsMock) {
        res.status(400).json({ error: 'Not a replay' });
        return;
    }
    mockService.setPaused(!!req.body?.paused);
    const next = { isMock: true, paused: mockService.isPaused() };
    ioGlobal.emit('mockUpdate', next);
    res.json(next);
});

app.get('/watchlist', (req, res) => {
    res.json(watchlist.getWatchlist());
});

app.post('/watchlist', jsonParser, (req, res) => {
    const quote = typeof req.body?.quote === 'string' ? req.body.quote.trim().toUpperCase() : '';
    if (!/^[A-Z][A-Z.]{0,9}$/.test(quote)) {
        res.status(400).json({ error: 'Enter a ticker symbol, like AAPL or BRK.B' });
        return;
    }
    const next = watchlist.watch(quote);
    ioGlobal.emit('watchlistUpdate', next);
    quotesIterator.followQuote(quote);
    premarketRace.refreshWatched();
    res.json(next);
});

app.delete('/watchlist/:quote', (req, res) => {
    const next = watchlist.unwatch(req.params.quote);
    ioGlobal.emit('watchlistUpdate', next);
    premarketRace.refreshWatched();
    res.json(next);
});

app.post('/addNewQuote',jsonParser,async (req, res) => {
    const data = req.body;
    await quotesIterator.addNewQuote(data.quote);
    res.sendStatus(200);
});

app.post('/followQuote',jsonParser,async (req, res) => {
    const data = req.body;
    state.updateTacticalDirectionSignal(data.quoteName,data.followType,data.direction);
    res.sendStatus(200);
});

const PORT = 11111;

export const ioGlobal = io.on('connection', (socket: any) => {
    console.log(`Client ${socket.id} connected`);

    // Join a conversation
    // const { roomId } = socket.handshake.query;
    // socket.join(roomId);

    // // Listen for new messages
    // socket.on(NEW_CHAT_MESSAGE_EVENT, (data: any) => {
    //     io.in(roomId).emit(NEW_CHAT_MESSAGE_EVENT, data);
    // });

    // // Leave the room if the user closes the socket
    // socket.on('disconnect', () => {
    //     console.log(`Client ${socket.id} diconnected`);
    //     socket.leave(roomId);
    // });
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

export const updateQuote = (quote: QuoteState,shouldSendPush:boolean) => {
    const quoteToUpdate = _.omit(quote, ['quoteStatistics']);
    if (true) {
        SignalToClients(quote);
    }

    ioGlobal.emit('updateQuote', quoteToUpdate);
};

export const emitRaceUpdate = (snapshot: premarketRace.IRaceSnapshot) => {
    ioGlobal.emit('raceUpdate', snapshot);
};

export const emitMarketWatchUpdate = (state: marketWatch.IMarketWatchState) => {
    ioGlobal.emit('marketWatchUpdate', state);
};

export const emitMarketAlert = (event: marketWatch.IMarketAlertEvent) => {
    ioGlobal.emit('marketAlert', event);
};

const SignalToClients = async (quote: QuoteState) => {
   
    if (!isInPushPolicy(quote)) {
        return;
    }

    sendAppSignals(quote);
    //sendSocialSignals(quote);
    
};
const sendAppSignals = (quote: QuoteState) => {
    let message = quote.quoteName + ':';
    let signalsWithNotificationsCount=0;

    const signals = _.filter(quote.signalsHistory, { interval: quote.quoteStatistics.intervalCount }) as QuoteStateSignals[];
    signals.forEach((signal) => {
        if (signal.signalDetails.withNotification) {
            if (globalConfig.Notifications?.allowedNotifications) {
                if (globalConfig.Notifications?.allowedNotifications.groupTypes.includes(signal.signalDetails.signalGroupType)){
                    message+= signal.signalDetails.signalDescription + '\r\n';
                    signalsWithNotificationsCount++;
                } 
            } else {
                message += signal.signalDetails.signalDescription + '\r\n';
                signalsWithNotificationsCount++;
            }
            
        }
    });
    if (message.length > 59) {
        message = quote.quoteName + ': ' + signals.length + ' Simultanious Signals - Open to view details!';
    }
    if (signalsWithNotificationsCount>0){ 
        const response = PushAPI.sendPushMessage(message);
    }
}
const sendSocialSignals = (quote: QuoteState) => { 
    let message ="FREE Intraday Real-Time Stocks Signals Powered By Algo AI  $"+quote.quoteName + ':\n\n';
    let signalsWithNotificationsCount=0;

    // const signals = _.filter(quote.signalsHistory, { interval: quote.quoteStatistics.intervalCount }) as QuoteStateSignals[];
    // signals.forEach((signal) => {
    //     if (signal.signalDetails.withNotification) {
    //         if (globalConfig.Notifications?.socialAllowedNotifications) {
    //             if (signal.signalDetails.socialSignalDescription?.includes('⭐')) {
    //                 if (globalConfig.Notifications?.socialAllowedNotifications.groupTypes.includes(signal.signalDetails.signalGroupType)){
    //                     message+= (signal.signalDetails.socialSignalDescription? signal.signalDetails.socialSignalDescription: + signal.signalDetails.signalDescription)+'\r\n';
    //                     signalsWithNotificationsCount++;
    //                 } 
    //             }
    //         } 
    //     }
    // });

    message+='\n\n $SPX $SPY $QQQ';
   
    if (signalsWithNotificationsCount>0){ 
        TwitterAPI.postTweet(message);
    }
}


const isInPushPolicy = (quote: QuoteState) => {
    const signals = _.filter(quote.signalsHistory, { interval: quote.quoteStatistics.intervalCount }) as QuoteStateSignals[];
    if (signals.length>=1) {
        return true;
    }
    else {
        return false
    }
}
