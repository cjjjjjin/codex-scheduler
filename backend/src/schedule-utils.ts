import { CronExpressionParser } from "cron-parser";

import { APP_TIMEZONE } from "./config.js";

export function nowInAppTimezone(): Date {
  return new Date();
}

export function validateSchedule(schedule: string): void {
  try {
    CronExpressionParser.parse(schedule, {
      currentDate: new Date(),
      tz: APP_TIMEZONE
    });
  } catch {
    throw new Error("Invalid CRON schedule.");
  }
}

export function getNextRunAt(schedule: string, baseTime: Date = nowInAppTimezone()): Date {
  validateSchedule(schedule);
  const interval = CronExpressionParser.parse(schedule, {
    currentDate: baseTime,
    tz: APP_TIMEZONE
  });
  return interval.next().toDate();
}
