export const schoolTimeZone = process.env.PRONOTE_TIMEZONE ?? "Europe/Paris";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: schoolTimeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function schoolParts(timestamp: number) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetAt(timestamp: number) {
  const whole = timestamp - (((timestamp % 1000) + 1000) % 1000);
  const parts = schoolParts(whole);
  return Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second) - whole;
}

export function fromSchoolClock(date: Date) {
  const wall = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  let instant = wall - offsetAt(wall);
  const corrected = offsetAt(instant);
  if (wall - instant !== corrected) instant = wall - corrected;
  return new Date(instant);
}

export function toSchoolClock(date: Date) {
  const parts = schoolParts(date.getTime());
  return new Date(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, date.getMilliseconds());
}

const dateKeys = new Set(["from", "to", "date", "dueDate", "start", "end"]);

export function shiftDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(shiftDates) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (dateKeys.has(key) && typeof child === "string") {
        const parsed = new Date(child);
        if (!Number.isNaN(parsed.getTime())) return [key, fromSchoolClock(parsed).toISOString()];
      }
      return [key, shiftDates(child)];
    }),
  ) as T;
}
