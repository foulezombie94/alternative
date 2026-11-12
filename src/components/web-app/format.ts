import type { Score } from "@/lib/pronote/types";

export function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatTime(value: string | Date, locale: string) {
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(value: string | Date, locale: string, withYear = false) {
  return new Date(value).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear && { year: "numeric" }),
  });
}

export function formatShortDate(value: string | Date, locale: string) {
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function formatScore(score: Score | undefined, locale: string, digits = 2) {
  if (!score) return "–";
  if (score.label) return score.label;
  if (score.value === null) return "–";
  return score.value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatDuration(minutes: number, units: { hours: string; minutes: string }) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ${units.minutes}`;
  return rest ? `${hours} ${units.hours} ${rest.toString().padStart(2, "0")}` : `${hours} ${units.hours}`;
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
