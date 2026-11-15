"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { type CourseDTO, CourseKind, type CourseResourceDTO, CourseState, type HolidayDTO } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, capitalize, dayKey, endOfDay, formatDay, formatDuration, formatTime, sameDay, startOfWeek } from "./format";
import { Async, Attachments, Dialog, Empty, Html, isLive, LiveProgress, PageHeader, useNow, WeekNav } from "./ui";

const columnClasses: Record<number, string> = {
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
};

const desktopQuery = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

type Gap = { kind: "lunch" | "free" | "break"; from: Date; to: Date; minutes: number };

const lunchWindow = { start: 11.5, end: 14 };
const shortestLunch = 30;
const shortestFreePeriod = 45;
const shortestBreak = 10;

function gapsBefore(courses: CourseDTO[]) {
  const gaps = new Map<string, Gap>();
  let end: Date | null = null;
  let lunchFound = false;

  for (const course of courses) {
    const from = new Date(course.from);
    if (end && from > end) {
      const minutes = Math.round((from.getTime() - end.getTime()) / 60000);
      const startHour = end.getHours() + end.getMinutes() / 60;
      const endHour = from.getHours() + from.getMinutes() / 60;
      const overLunch = startHour < lunchWindow.end && endHour > lunchWindow.start;
      if (overLunch && !lunchFound && minutes >= shortestLunch) {
        lunchFound = true;
        gaps.set(course.id, { kind: "lunch", from: end, to: from, minutes });
      } else if (minutes >= shortestFreePeriod) {
        gaps.set(course.id, { kind: "free", from: end, to: from, minutes });
      } else if (minutes >= shortestBreak) {
        gaps.set(course.id, { kind: "break", from: end, to: from, minutes });
      }
    }
    const to = new Date(course.to);
    if (!end || to > end) end = to;
  }
  return gaps;
}

function GapRow({ gap, compact = false }: { gap: Gap; compact?: boolean }) {
  const { t, locale } = useWebApp();
  if (gap.kind === "break") {
    return (
      <div className="flex w-full items-center gap-2 px-1 text-xs text-foreground/45">
        <span className="h-px flex-1 bg-foreground/10" />
        <span className="font-medium">{t.timetable.break}</span>
        <span className="tabular-nums max-sm:hidden">
          {formatTime(gap.from, locale)} – {formatTime(gap.to, locale)}
        </span>
        <span className="h-px flex-1 bg-foreground/10" />
      </div>
    );
  }
  return (
    <div
      className={`flex w-full flex-col justify-center rounded-lg border border-dashed border-foreground/15 text-foreground/50 ${
        compact ? "px-1.5 py-1 text-xs max-sm:items-center sm:px-3 sm:py-2 sm:text-sm" : "px-4 py-2.5 text-sm"
      }`}
    >
      <span className="font-medium max-sm:truncate">{gap.kind === "lunch" ? t.timetable.lunch : t.timetable.freePeriod}</span>
      <span className={`text-xs tabular-nums ${compact ? "max-sm:hidden" : ""}`}>
        {formatTime(gap.from, locale)} – {formatTime(gap.to, locale)} ·{" "}
        {formatDuration(gap.minutes, { hours: t.common.hours, minutes: t.common.minutes })}
      </span>
    </div>
  );
}

function holidayOn(holidays: HolidayDTO[] | undefined, day: Date) {
  const time = day.getTime();
  return holidays?.find((holiday) => {
    const start = new Date(holiday.start);
    start.setHours(0, 0, 0, 0);
    return start.getTime() <= time && time <= endOfDay(new Date(holiday.end)).getTime();
  });
}

function HolidayPanel({ holiday, compact = false }: { holiday: HolidayDTO; compact?: boolean }) {
  const { t } = useWebApp();
  const label = /vacances|vacation|holidays/i.test(holiday.name) ? t.timetable.vacation : t.timetable.holiday;

  return (
    <div
      className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-background ${
        compact ? "min-h-64 sm:min-h-96" : "min-h-72"
      }`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--color-foreground) 5%, transparent) 0 12px, transparent 12px 24px)",
      }}
    >
      <div className={`flex flex-col items-center text-center ${compact ? "max-sm:-rotate-90 sm:-rotate-45" : "-rotate-12"}`}>
        <span
          className={`font-semibold tracking-tight text-foreground/25 uppercase ${compact ? "text-lg sm:text-5xl" : "text-5xl"}`}
        >
          {label}
        </span>
        <span className={`mt-1 max-w-48 text-sm font-medium text-foreground/50 ${compact ? "max-sm:hidden" : ""}`}>
          {holiday.name}
        </span>
      </div>
    </div>
  );
}

function Badge({ course }: { course: CourseDTO }) {
  const { t } = useWebApp();
  const label =
    course.kind === CourseKind.Detention
      ? t.timetable.detention
      : course.kind === CourseKind.Activity
        ? t.timetable.activity
        : course.state === CourseState.Canceled
          ? (course.statusText ?? t.timetable.canceled)
          : course.state === CourseState.Test
            ? t.timetable.test
            : course.state === CourseState.Edited
              ? (course.statusText ?? t.timetable.edited)
              : null;
  if (!label) return null;
  const tone =
    course.state === CourseState.Canceled || course.kind === CourseKind.Detention
      ? "bg-feature-schedule/10 text-feature-schedule"
      : course.state === CourseState.Test
        ? "bg-feature-news/10 text-feature-news"
        : "bg-feature-homework/10 text-feature-homework";
  return <span className={`inline-block max-w-full rounded-md px-2.5 py-0.5 text-xs font-medium wrap-anywhere ${tone}`}>{label}</span>;
}

function Resources({ resourceId }: { resourceId: string }) {
  const { t } = useWebApp();
  const state = useApi<CourseResourceDTO[]>("courseResources", { resourceId });
  return (
    <div className="mt-5 border-t border-foreground/5 pt-5">
      <h3 className="mb-3 font-semibold">{t.timetable.content}</h3>
      <Async state={state} empty={t.timetable.noContent} isEmpty={(list) => !list.length}>
        {(list) => (
          <div className="flex flex-col gap-4">
            {list.map((content, index) => (
              <div key={index}>
                {content.title && <p className="font-medium">{content.title}</p>}
                {content.description && <Html html={content.description} className="text-foreground/70" />}
                <Attachments files={content.attachments} />
              </div>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}

function CourseDetail({ course, onClose }: { course: CourseDTO; onClose: () => void }) {
  const { t, locale } = useWebApp();
  const rows = [
    [t.timetable.room, course.room],
    [t.timetable.teacher, course.teacher],
    [t.timetable.group, course.group],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <Dialog title={course.subject} onClose={onClose}>
      <p className="mb-3 text-foreground/60">
        {capitalize(formatDay(course.from, locale))} · {formatTime(course.from, locale)} – {formatTime(course.to, locale)}
      </p>
      <div className="mb-4">
        <Badge course={course} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-foreground/50">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {course.notes && <p className="mt-4 rounded-lg border border-foreground/10 bg-surface p-3">{course.notes}</p>}
      {course.resourceId && <Resources resourceId={course.resourceId} />}
    </Dialog>
  );
}

function CourseCard({
  course,
  compact,
  now,
  onSelect,
}: {
  course: CourseDTO;
  compact: boolean;
  now: Date;
  onSelect: () => void;
}) {
  const { locale } = useWebApp();
  const canceled = course.state === CourseState.Canceled;
  const live = isLive(course, now);
  const place = [course.room, course.teacher].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={live ? "time" : undefined}
      className={`flex w-full items-start rounded-lg text-left transition-colors hover:bg-foreground/5 ${
        compact ? "gap-1.5 p-1.5 sm:gap-3 sm:p-3" : "gap-4 p-4"
      } ${canceled ? "opacity-60" : ""} ${live ? "bg-accent/5 ring-2 ring-accent" : "bg-background"}`}
    >
      <span
        aria-hidden
        className={`shrink-0 self-stretch rounded-full bg-primary ${compact ? "w-0.5 sm:w-1" : "w-1"}`}
        style={course.color ? { backgroundColor: course.color } : undefined}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block font-medium tabular-nums text-foreground/50 ${compact ? "text-xs max-sm:leading-tight" : "text-sm"}`}
        >
          {formatTime(course.from, locale)}
          <span className={compact ? "max-sm:hidden" : ""}> – {formatTime(course.to, locale)}</span>
        </span>
        <span
          className={`block font-medium ${canceled ? "line-through" : ""} ${
            compact ? "text-xs leading-tight break-words hyphens-auto max-sm:line-clamp-3 sm:text-sm 2xl:text-base" : "text-lg wrap-anywhere"
          }`}
        >
          {course.subject}
        </span>
        {place && (
          <span className={`block truncate text-foreground/50 ${compact ? "text-xs max-sm:hidden sm:text-sm" : "text-sm"}`}>
            {place}
          </span>
        )}
        {compact && course.room && <span className="block truncate text-xs text-foreground/50 sm:hidden">{course.room}</span>}
        <span className={`mt-1 block ${compact ? "max-sm:hidden" : ""}`}>
          <Badge course={course} />
        </span>
        {compact && (canceled || course.state === CourseState.Test || course.state === CourseState.Edited) && (
          <span
            aria-hidden
            className={`mt-1 block h-1 rounded-full sm:hidden ${
              canceled
                ? "bg-feature-schedule"
                : course.state === CourseState.Test
                  ? "bg-feature-news"
                  : "bg-feature-homework"
            }`}
          />
        )}
        {live && <LiveProgress from={course.from} to={course.to} now={now} />}
      </span>
    </button>
  );
}

function clockMinutes(value: string | Date) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

type DayRange = { start: number; end: number };

function Spacer({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return <li aria-hidden style={{ flex: `${minutes} 1 0px` }} />;
}

function DayCourses({
  list,
  holiday,
  compact,
  range,
  now,
  onSelect,
}: {
  list: CourseDTO[];
  holiday: HolidayDTO | undefined;
  compact: boolean;
  range?: DayRange;
  now: Date;
  onSelect: (course: CourseDTO) => void;
}) {
  const { t } = useWebApp();
  const dayOff = holiday && !list.some((course) => course.state !== CourseState.Canceled);
  const gaps = gapsBefore(list);

  if (dayOff) return <HolidayPanel holiday={holiday} compact={compact} />;
  if (!list.length) {
    return <p className={`px-1 pb-2 text-foreground/40 ${compact ? "text-xs sm:text-sm" : "py-8 text-center"}`}>{t.common.empty}</p>;
  }
  if (range) {
    const rows: { course: CourseDTO; from: number; to: number; before: number }[] = [];
    const firstStart = list.length ? clockMinutes(list[0].from) : range.start;
    let cursor = firstStart;
    for (const course of list) {
      const from = clockMinutes(course.from);
      const to = Math.max(from + 15, clockMinutes(course.to));
      rows.push({ course, from, to, before: Math.max(0, from - cursor) });
      cursor = Math.max(cursor, to);
    }
    const after = Math.max(0, range.end - cursor) + Math.max(0, firstStart - range.start);

    return (
      <ul className="flex flex-1 flex-col">
        {rows.map(({ course, from, to, before }) => {
          const gap = gaps.get(course.id);
          return (
            <Fragment key={course.id}>
              {gap ? (
                <li className="flex py-1" style={{ flex: `${before} 1 0px` }}>
                  <GapRow gap={gap} compact />
                </li>
              ) : (
                <Spacer minutes={before} />
              )}
              <li className="flex py-1" style={{ flex: `${to - from} 1 0px` }}>
                <CourseCard course={course} compact={compact} now={now} onSelect={() => onSelect(course)} />
              </li>
            </Fragment>
          );
        })}
        <Spacer minutes={after} />
      </ul>
    );
  }

  return (
    <ul className={`flex flex-col ${compact ? "gap-1 sm:gap-2" : "gap-2"}`}>
      {list.map((course) => {
        const gap = gaps.get(course.id);
        return (
          <Fragment key={course.id}>
            {gap && (
              <li>
                <GapRow gap={gap} compact={compact} />
              </li>
            )}
            <li>
              <CourseCard course={course} compact={compact} now={now} onSelect={() => onSelect(course)} />
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

export function WebAppTimetable() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [dayIndex, setDayIndex] = useState(() => Math.min(Math.max((new Date().getDay() + 6) % 7, 0), 4));
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia(desktopQuery).matches, () => false);
  const view = desktop ? "week" : "day";
  const [selected, setSelected] = useState<CourseDTO | null>(null);
  const now = useNow();
  const range = useMemo(
    () => ({ from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() }),
    [week],
  );
  const state = useApi<CourseDTO[]>("timetable", range);
  const holidays = useApi<HolidayDTO[]>("holidays");
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);

  function changeWeek(next: Date) {
    setWeek(next);
    const today = new Date();
    if (startOfWeek(today).getTime() === next.getTime()) setDayIndex(Math.min((today.getDay() + 6) % 7, 6));
  }

  return (
    <>
      <PageHeader title={t.nav.timetable}>
        <WeekNav week={week} onChange={changeWeek} onPickDay={(day) => setDayIndex((day.getDay() + 6) % 7)} />
      </PageHeader>
      <Async state={state}>
        {(courses) => {
          const days = Array.from({ length: 7 }, (_, index) => addDays(week, index)).filter(
            (day, index) => index < 5 || courses.some((course) => sameDay(new Date(course.from), day)),
          );
          const weekHolidays = days.map((day) => holidayOn(holidays.data, day));
          const coursesOn = (day: Date) => courses.filter((course) => sameDay(new Date(course.from), day));
          const weekRange: DayRange | undefined = courses.length
            ? {
                start: Math.min(...courses.map((course) => clockMinutes(course.from))),
                end: Math.max(...courses.map((course) => clockMinutes(course.to))),
              }
            : undefined;

          if (view === "day") {
            const index = Math.min(dayIndex, days.length - 1);
            const day = days[index];
            return (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div role="tablist" className={`grid gap-1.5 sm:gap-2 ${columnClasses[days.length] ?? "grid-cols-5"}`}>
                  {days.map((entry, position) => {
                    const active = position === index;
                    const today = sameDay(entry, new Date());
                    const count = coursesOn(entry).filter((course) => course.state !== CourseState.Canceled).length;
                    return (
                      <button
                        key={dayKey(entry)}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setDayIndex(position)}
                        className={`flex flex-col items-center rounded-xl border py-2 transition-colors ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : today
                              ? "border-accent/50 bg-accent/5 text-accent hover:border-accent"
                              : "border-foreground/10 bg-surface hover:border-foreground/30"
                        }`}
                      >
                        <span className="text-xs font-medium uppercase opacity-70">{weekday.format(entry).replace(".", "")}</span>
                        <span className="text-xl font-semibold tabular-nums">{entry.getDate()}</span>
                        <span
                          aria-hidden
                          className={`mt-1 size-1.5 rounded-full ${
                            weekHolidays[position] ? "bg-current opacity-30" : count ? "bg-current opacity-60" : "opacity-0"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <section
                  className={`rounded-xl border p-3 sm:p-5 ${
                    sameDay(day, new Date()) ? "border-accent/50 bg-accent/5" : "border-foreground/10 bg-surface"
                  }`}
                >
                  <h2 className={`mb-4 px-1 text-lg font-semibold ${sameDay(day, new Date()) ? "text-accent" : ""}`}>
                    {capitalize(formatDay(day, locale, true))}
                  </h2>
                  <DayCourses
                    list={coursesOn(day)}
                    holiday={weekHolidays[index]}
                    compact={false}
                    now={now}
                    onSelect={setSelected}
                  />
                </section>
              </div>
            );
          }

          if (!courses.length && !weekHolidays.some(Boolean)) return <Empty>{t.timetable.noCourses}</Empty>;

          return (
            <div className={`grid min-h-timetable gap-3 ${columnClasses[days.length] ?? "grid-cols-5"}`}>
              {days.map((day, position) => {
                const today = sameDay(day, new Date());
                return (
                  <section
                    key={dayKey(day)}
                    className={`flex min-w-0 flex-col rounded-lg border p-1 sm:rounded-xl sm:p-3 ${
                      today ? "border-accent/50 bg-accent/5" : "border-foreground/10 bg-surface"
                    }`}
                  >
                    <h2 className={`mb-2 text-center font-semibold sm:mb-3 sm:px-1 sm:text-left ${today ? "text-accent" : ""}`}>
                      <span className="flex flex-col text-xs leading-tight sm:hidden">
                        <span className="uppercase opacity-70">{weekday.format(day).replace(".", "")}</span>
                        <span className="text-base">{day.getDate()}</span>
                      </span>
                      <span className="max-sm:hidden">{capitalize(formatDay(day, locale))}</span>
                    </h2>
                    <DayCourses
                      list={coursesOn(day)}
                      holiday={weekHolidays[position]}
                      compact
                      range={weekRange}
                      now={now}
                      onSelect={setSelected}
                    />
                  </section>
                );
              })}
            </div>
          );
        }}
      </Async>
      {selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
