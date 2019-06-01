import * as request from "request";

const url = "https://api.pushed.co/1/push";

export const sendPushMessage = (message: string) => {
    const formData = {
        app_key: "6MHfu13fe8x87a8xhhU6",
        app_secret: "FgEq6GBXyaN5ItNuEDxYGzeYWwHj5hAMjGsp5jI4dfXFnCFeSYmPjVhLhCsMdllb",
        content: message,
        target_type: "app",
    };

    request.post({url, formData}, (err: string, httpResponse: any, body: any) => {
        if (err) {
            return console.error("pushing message:" + message +  "failed:", err);
        }
        console.log("Upload successful!  Server responded with:", body);
    });
  };
