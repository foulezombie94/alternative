"use client";

import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User } from "@getpapillon/papicons";
import { type CSSProperties, useMemo, useState } from "react";
import { type CourseDTO, CourseKind, type CourseResourceDTO, CourseState } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, capitalize, dayKey, endOfDay, formatDay, formatTime, sameDay, startOfWeek } from "./format";
import { Async, Attachments, Dialog, Html } from "./ui";

const hourHeight = 64;
const fallbackColor = "var(--color-primary)";

type Placed = CourseDTO & { column: number; columns: number };

function hoursOf(date: Date) {
  return date.getHours() + date.getMinutes() / 60;
}

function layoutDay(courses: CourseDTO[]): Placed[] {
  const sorted = [...courses].sort((a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to));
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = "";

  const flush = () => {
    const columns = Math.max(1, ...group.map((course) => course.column + 1));
    for (const course of group) course.columns = columns;
    placed.push(...group);
    group = [];
    groupEnd = "";
  };

  for (const course of sorted) {
    if (group.length && course.from >= groupEnd) flush();
    const taken = new Set(group.filter((other) => other.to > course.from).map((other) => other.column));
    let column = 0;
    while (taken.has(column)) column++;
    group.push({ ...course, column, columns: 1 });
    if (course.to > groupEnd) groupEnd = course.to;
  }
  if (group.length) flush();
  return placed;
}

function tint(color: string | undefined, amount: number) {
  return `color-mix(in oklab, ${color ?? fallbackColor} ${amount}%, white)`;
}

function shade(color: string | undefined) {
  return `color-mix(in oklab, ${color ?? fallbackColor} 75%, black)`;
}

function StatusLabel({ course }: { course: CourseDTO }) {
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
  return (
    <span className="inline-block rounded-full bg-foreground/5 px-2.5 py-0.5 text-xs font-medium text-foreground/70">
      {label}
    </span>
  );
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
        <StatusLabel course={course} />
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-6">
            <dt className="w-28 text-foreground/50">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {course.notes && <p className="mt-4 rounded-2xl bg-surface p-3">{course.notes}</p>}
      {course.resourceId && <Resources resourceId={course.resourceId} />}
    </Dialog>
  );
}

function CourseBlock({ course, startHour, onOpen }: { course: Placed; startHour: number; onOpen: () => void }) {
  const { locale } = useWebApp();
  const from = new Date(course.from);
  const to = new Date(course.to);
  const top = (hoursOf(from) - startHour) * hourHeight;
  const height = Math.max((hoursOf(to) - hoursOf(from)) * hourHeight - 3, 22);
  const canceled = course.state === CourseState.Canceled;
  const compact = height < 44;
  const width = 100 / course.columns;

  const style: CSSProperties = {
    top,
    height,
    left: `calc(${course.column * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    backgroundColor: canceled ? "transparent" : tint(course.color, 22),
    borderColor: canceled ? "color-mix(in oklab, currentColor 25%, transparent)" : (course.color ?? fallbackColor),
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={`absolute flex flex-col overflow-hidden rounded-md border-l-3 px-1.5 py-1 text-left transition-[filter,box-shadow] hover:shadow-md hover:brightness-95 ${
        canceled ? "text-foreground/40" : ""
      }`}
    >
      <span
        className={`text-xs leading-tight font-semibold ${compact ? "truncate" : "line-clamp-2"} ${canceled ? "line-through" : ""}`}
        style={canceled ? undefined : { color: shade(course.color) }}
      >
        {course.subject}
      </span>
      {!compact && (
        <>
          {course.room && <span className="truncate text-xs leading-tight text-foreground/60">{course.room}</span>}
          <span className="truncate text-xs leading-tight text-foreground/50 tabular-nums">
            {formatTime(from, locale)} – {formatTime(to, locale)}
          </span>
        </>
      )}
    </button>
  );
}

function NextCourse({ courses, onOpen }: { courses: CourseDTO[]; onOpen: (course: CourseDTO) => void }) {
  const { locale } = useWebApp();
  const now = new Date();
  const next = courses
    .filter((course) => new Date(course.from) > now && course.state !== CourseState.Canceled)
    .sort((a, b) => a.from.localeCompare(b.from))[0];
  if (!next) return null;

  const minutes = Math.round((new Date(next.from).getTime() - now.getTime()) / 60000);
  const [value, unit] =
    minutes >= 60 * 24
      ? [Math.round(minutes / (60 * 24)), "day"]
      : minutes >= 60
        ? [Math.round(minutes / 60), "hour"]
        : [minutes, "minute"];
  const delay = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(value as number);

  return (
    <div className="pointer-events-none sticky bottom-4 z-20 mt-4 flex justify-center">
      <button
        type="button"
        onClick={() => onOpen(next)}
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border-2 bg-background px-4 py-2.5 text-left shadow-lg transition-transform hover:scale-102"
        style={{ borderColor: next.color ?? fallbackColor }}
      >
        <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: next.color ?? fallbackColor }} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{next.subject}</span>
          <span className="flex items-center gap-3 text-sm text-foreground/50">
            {next.room && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {next.room}
              </span>
            )}
            {next.teacher && (
              <span className="flex items-center gap-1 truncate">
                <User className="size-3.5" />
                {next.teacher}
              </span>
            )}
          </span>
        </span>
        <span
          className="ml-2 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold"
          style={{ backgroundColor: tint(next.color, 20), color: shade(next.color) }}
        >
          <Clock className="size-3.5" />
          {delay}
        </span>
      </button>
    </div>
  );
}

export function WebAppTimetable() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<CourseDTO | null>(null);
  const range = useMemo(() => ({ from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() }), [week]);
  const state = useApi<CourseDTO[]>("timetable", range);
  const upcomingRange = useMemo(() => {
    const now = new Date();
    return { from: now.toISOString(), to: endOfDay(addDays(now, 21)).toISOString() };
  }, []);
  const upcoming = useApi<CourseDTO[]>("timetable", upcomingRange);

  const month = capitalize(addDays(week, 2).toLocaleDateString(locale, { month: "long", year: "numeric" }));
  const navButton =
    "flex size-9 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground";

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-foreground/5 bg-background shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b border-foreground/5 px-3 py-2">
          <button
            type="button"
            aria-label={t.common.thisWeek}
            title={t.common.thisWeek}
            onClick={() => setWeek(startOfWeek(new Date()))}
            className="flex size-9 items-center justify-center rounded-xl bg-surface transition-colors hover:bg-foreground/10"
          >
            <Calendar className="size-5" />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t.common.previousWeek} className={navButton} onClick={() => setWeek(addDays(week, -7))}>
              <ChevronLeft className="size-5" />
            </button>
            <h1 className="min-w-40 text-center text-lg font-semibold">{month}</h1>
            <button type="button" aria-label={t.common.nextWeek} className={navButton} onClick={() => setWeek(addDays(week, 7))}>
              <ChevronRight className="size-5" />
            </button>
          </div>
          <span className="size-9" />
        </header>

        <Async state={state}>
          {(courses) => {
            const days = Array.from({ length: 7 }, (_, index) => addDays(week, index)).filter(
              (day, index) => index < 5 || courses.some((course) => sameDay(new Date(course.from), day)),
            );
            const starts = courses.map((course) => Math.floor(hoursOf(new Date(course.from))));
            const ends = courses.map((course) => Math.ceil(hoursOf(new Date(course.to))));
            const startHour = Math.min(8, ...starts);
            const endHour = Math.max(18, ...ends);
            const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
            const gridHeight = (endHour - startHour) * hourHeight;
            const now = new Date();
            const nowTop = (hoursOf(now) - startHour) * hourHeight;

            return (
              <div className="overflow-x-auto">
                <div className="min-w-160">
                  <div className="flex border-b border-foreground/5">
                    <div className="w-12 shrink-0" />
                    {days.map((day) => {
                      const today = sameDay(day, now);
                      return (
                        <div key={dayKey(day)} className="flex flex-1 flex-col items-center gap-1 py-2">
                          <span
                            className={`text-xs font-semibold tracking-wide uppercase ${today ? "text-primary" : "text-foreground/40"}`}
                          >
                            {day.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}
                          </span>
                          <span
                            className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                              today ? "bg-primary text-white" : ""
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative flex" style={{ height: gridHeight + 16 }}>
                    <div className="relative w-12 shrink-0">
                      {hours.map((hour) => (
                        <span
                          key={hour}
                          className="absolute right-2 -translate-y-1/2 text-xs text-foreground/40 tabular-nums"
                          style={{ top: (hour - startHour) * hourHeight + 8 }}
                        >
                          {String(hour).padStart(2, "0")}:00
                        </span>
                      ))}
                    </div>

                    <div className="relative mt-2 flex flex-1">
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          aria-hidden
                          className="absolute inset-x-0 border-t border-foreground/5"
                          style={{ top: (hour - startHour) * hourHeight }}
                        />
                      ))}

                      {days.map((day) => {
                        const placed = layoutDay(courses.filter((course) => sameDay(new Date(course.from), day)));
                        const today = sameDay(day, now);
                        return (
                          <div key={dayKey(day)} className="relative flex-1 border-l border-foreground/5" style={{ height: gridHeight }}>
                            {placed.map((course) => (
                              <CourseBlock key={course.id} course={course} startHour={startHour} onOpen={() => setSelected(course)} />
                            ))}
                            {today && nowTop >= 0 && nowTop <= gridHeight && (
                              <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                                <div className="h-0.5 bg-primary" />
                                <div className="absolute -top-1 -left-1 size-2.5 rounded-full bg-primary" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </Async>
      </div>

      {upcoming.data && <NextCourse courses={upcoming.data} onOpen={setSelected} />}
      {selected && <CourseDetail course={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
