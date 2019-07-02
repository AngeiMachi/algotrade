import * as appRoot from "app-root-path";
import winston from "winston";

const options = {
    file: {
      level: "debug",
      filename: `${appRoot.path}/logs/app.log`,
      handleExceptions: true,
      json: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: true,
    },
    console: {
      level: "debug",
      handleExceptions: true,
      json: true,
      colorize: true,
    },
  };

export const logger = winston.createLogger({
    transports: [
      new winston.transports.File(options.file),
      new winston.transports.Console(options.console),
    ],
    exitOnError: false, // do not exit on handled exceptions
  });
