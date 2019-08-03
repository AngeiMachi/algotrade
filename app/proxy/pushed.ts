import * as environmentConfig from "../config/environment.Config.json";
import * as request from "request";

const url = "https://api.pushed.co/1/push";

const pushedConfig = {
    app_key: environmentConfig.PushedNotifications.appKey,
    app_secret: environmentConfig.PushedNotifications.appSecret,
    target_type: environmentConfig.PushedNotifications.targetType,
};

export const sendPushMessage = (message: string) => {
    if (environmentConfig.ShouldUsePushNotifications) {
        const formData = {
            ...pushedConfig,
            content: message,
        };

        request.post({url, formData}, (err: string, httpResponse: any, body: any) => {
            if (err) {
                return console.error("pushing message:" + message +  "failed:", err);
            }
        });
    }

  };
