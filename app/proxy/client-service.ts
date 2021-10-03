import * as _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { QuoteState } from '../models/state.model';
import { getState } from '../engine/state';
import express from 'express';
import * as OneSignal from 'onesignal-node';
const app = express();

const oneSignalclient = new OneSignal.Client('6caf4483-266e-4b54-a9f8-c3e53671ebf6', 'MjZjMDNkODctMGE3Ny00ODZjLTk2MjItMjA1NTAxMzU4ZGQw');
const server = require('http').Server(app);

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    },
});

//app.use(cors());
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

app.get('/getAllQuotes', function (req, res) {
    res.json(getState());
});

const PORT = 55555;

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

export const updateQuote = (quote: QuoteState) => {
    const quoteToUpdate = _.omit(quote, ['quoteStatistics']);
    sendPush(quote);
    ioGlobal.emit('updateQuote', quoteToUpdate);
};

const sendPush = async (quote: QuoteState) => {
    let message = quote.quoteName + ': ';

    //@ts-ignore
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
