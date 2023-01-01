import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { QuoteState, QuoteStateSignals } from '../models/state.model';
import { getState } from '../engine/state';
import express from 'express';

import * as OneSignal from 'onesignal-node';
import { ShouldUsePushNotifications } from '../config/globals.config';
import * as environmentConfig from '../config/environment.Config.json';
import * as quotesIterator from '../engine/quotes-iterator';
const app = express();

const oneSignalclient = new OneSignal.Client('6caf4483-266e-4b54-a9f8-c3e53671ebf6', 'MjZjMDNkODctMGE3Ny00ODZjLTk2MjItMjA1NTAxMzU4ZGQw');
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

app.post('/addNewQuote',jsonParser,async (req, res) => {
    const data = req.body;
    await quotesIterator.addNewQuote(data.quote);
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
    if (ShouldUsePushNotifications && shouldSendPush) {
        sendPush(quote);
    }

    ioGlobal.emit('updateQuote', quoteToUpdate);
};

const sendPush = async (quote: QuoteState) => {
    let message = quote.quoteName + ': ';

    if (!isInPushPolicy(quote)) {
        return;
    }

    const signals = _.filter(quote.signalsHistory, { interval: quote.quoteStatistics.intervalCount }) as QuoteStateSignals[];
    signals.forEach((signal) => {
        message += signal.signalDetails.signalDescription + '\r\n';
    });
    if (message.length > 59) {
        message = quote.quoteName + ': ' + signals.length + ' Simultanious Signals - Open to view details!';
    }
    const notification = {
        contents: {
            en: message,
        },
        web_push_topic: '' + uuidv4(),
        included_segments: ['Subscribed Users'],
    };

    // using async/await
    try {
        const response = await oneSignalclient.createNotification(notification);
        console.log(response.body.id);
    } catch (e) {
        if (e instanceof OneSignal.HTTPError) {
            // When status code of HTTP response is not 2xx, HTTPError is thrown.
            console.log(e.statusCode);
            console.log(e.body);
        }
    }
};

const isInPushPolicy = (quote: QuoteState) => {
    const leaders = environmentConfig.quotes.LEADERS;
    const signals = _.filter(quote.signalsHistory, { interval: quote.quoteStatistics.intervalCount }) as QuoteStateSignals[];
    if (_.includes(leaders,quote.quoteName)) {
        return true;
    }
    else if (signals.length>1) {
        return true;
    }
    else {
        return false
    }
}
