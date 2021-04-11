import * as environmentConfig from "../config/environment.Config.json";
import * as globalConfig from "../config/globals.config"
import * as request from "request";

const pushedConfig = {
    app_key: environmentConfig.PushedNotifications.appKey,
    app_secret: environmentConfig.PushedNotifications.appSecret,
    target_type: environmentConfig.PushedNotifications.targetType,
};

export const sendPushMessage = (message: string) => {
    if (globalConfig.ShouldUsePushNotifications) {
        const formData = {
            ...pushedConfig,
            content: message,
        };

        const url = environmentConfig.PushedNotifications.URL;

        request.post({ url , formData}, (err: string, httpResponse: any, body: any) => {
            if (err) {
                return console.error("pushing message:" + message +  "failed:", err);
            }
        });
    }

  };
