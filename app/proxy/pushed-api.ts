import * as environmentConfig from "../config/environment.Config.json";
import * as globalConfig from "../config/globals.config"
import * as OneSignal from 'onesignal-node';
import { v4 as uuidv4 } from 'uuid';

const oneSignalclient = new OneSignal.Client('6caf4483-266e-4b54-a9f8-c3e53671ebf6', 'MjZjMDNkODctMGE3Ny00ODZjLTk2MjItMjA1NTAxMzU4ZGQw');

const pushedConfig = {
    app_key: environmentConfig.PushedNotifications.appKey,
    app_secret: environmentConfig.PushedNotifications.appSecret,
    target_type: environmentConfig.PushedNotifications.targetType,
};

export const sendPushMessage = async (message: string) => {
    if (globalConfig.ShouldUsePushNotifications) {
        const notification = {
            contents: {
                en: message,
            },
            web_push_topic: '' + uuidv4(),
            included_segments: ['Subscribed Users'],
        };
    
        // using async/await
        try {
            if (message.length>0){
                const response = await oneSignalclient.createNotification(notification);
                console.log(response.body.id);
            }
        } catch (e) {
            if (e instanceof OneSignal.HTTPError) {
                // When status code of HTTP response is not 2xx, HTTPError is thrown.
                console.log(e.statusCode);
                console.log(e.body);
            }
        }
    }

  };
