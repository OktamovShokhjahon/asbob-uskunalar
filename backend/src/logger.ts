import pino from "pino";
import { config } from "./config";

export const logger = pino({
  level: config.isTest ? "silent" : config.LOG_LEVEL,
  // Personal data must never reach the logs.
  redact: { paths: ["customerName", "*.customerName", "req.body"], remove: true },
  transport:
    config.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});
