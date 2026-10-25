import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TASHKENT = "Asia/Tashkent";

export function formatTashkent(date: Date, pattern = "dd.MM.yyyy HH:mm") {
  return formatInTimeZone(date, TASHKENT, pattern);
}

export function tashkentInputToUtc(value: string) {
  return fromZonedTime(value, TASHKENT);
}

export function utcToTashkentInput(date: Date) {
  return formatInTimeZone(date, TASHKENT, "yyyy-MM-dd'T'HH:mm");
}

export function countdownParts(target: Date, now: Date) {
  const diff = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: diff <= 0,
  };
}
