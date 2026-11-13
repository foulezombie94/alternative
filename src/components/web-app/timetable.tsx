"use client";

import { useMemo, useState } from "react";
import { type CourseDTO, CourseKind, type CourseResourceDTO, CourseState, type HolidayDTO } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, capitalize, dayKey, endOfDay, formatDay, formatTime, sameDay, startOfWeek } from "./format";
import { Async, Attachments, Dialog, Empty, Html, isLive, LiveProgress, PageHeader, useNow, WeekNav } from "./ui";

const columnClasses: Record<number, string> = {
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
};

function holidayOn(holidays: HolidayDTO[] | undefined, day: Date) {
  const time = day.getTime();
  return holidays?.find((holiday) => {
    const start = new Date(holiday.start);
    start.setHours(0, 0, 0, 0);
    return start.getTime() <= time && time <= endOfDay(new Date(holiday.end)).getTime();
  });
}

function HolidayPanel({ holiday }: { holiday: HolidayDTO }) {
  const { t } = useWebApp();
  const label = /vacances|vacation|holidays/i.test(holiday.name) ? t.timetable.vacation : t.timetable.holiday;

  return (
    <div
      className="relative flex min-h-96 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-background"
      style={{
        backgroundImage:
          "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--color-foreground) 5%, transparent) 0 12px, transparent 12px 24px)",
      }}
    >
      <div className="flex -rotate-45 flex-col items-center text-center">
        <span className="text-5xl font-semibold tracking-tight text-foreground/25 uppercase">{label}</span>
        <span className="mt-1 max-w-48 text-sm font-medium text-foreground/50">{holiday.name}</span>
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
  return <span className={`inline-block max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium wrap-anywhere ${tone}`}>{label}</span>;
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
      {course.notes && <p className="mt-4 rounded-2xl bg-surface p-3">{course.notes}</p>}
      {course.resourceId && <Resources resourceId={course.resourceId} />}
    </Dialog>
  );
}

export function WebAppTimetable() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<CourseDTO | null>(null);
  const now = useNow();
  const range = useMemo(
    () => ({ from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() }),
    [week],
  );
  const state = useApi<CourseDTO[]>("timetable", range);
  const holidays = useApi<HolidayDTO[]>("holidays");

  return (
    <>
      <PageHeader title={t.nav.timetable}>
        <WeekNav week={week} onChange={setWeek} />
      </PageHeader>
      <Async state={state}>
        {(courses) => {
          const days = Array.from({ length: 7 }, (_, index) => addDays(week, index)).filter(
            (day, index) => index < 5 || courses.some((course) => sameDay(new Date(course.from), day)),
          );
          const weekHolidays = days.map((day) => holidayOn(holidays.data, day));
          if (!courses.length && !weekHolidays.some(Boolean)) return <Empty>{t.timetable.noCourses}</Empty>;

          return (
            <div className={`grid gap-3 sm:grid-cols-2 md:grid-cols-3 ${columnClasses[days.length] ?? "lg:grid-cols-5"}`}>
              {days.map((day, dayIndex) => {
                const list = courses.filter((course) => sameDay(new Date(course.from), day));
                const today = sameDay(day, new Date());
                const holiday = weekHolidays[dayIndex];
                const dayOff = holiday && !list.some((course) => course.state !== CourseState.Canceled);
                return (
                  <section
                    key={dayKey(day)}
                    className={`flex min-w-0 flex-col rounded-3xl p-3 ${today ? "bg-primary/10" : "bg-surface"}`}
                  >
                    <h2 className={`mb-3 px-1 font-semibold ${today ? "text-primary" : ""}`}>
                      {capitalize(formatDay(day, locale))}
                    </h2>
                    {dayOff && <HolidayPanel holiday={holiday} />}
                    {!list.length && !dayOff && <p className="px-1 pb-2 text-sm text-foreground/40">{t.common.empty}</p>}
                    <ul className={`flex flex-col gap-2 ${dayOff ? "hidden" : ""}`}>
                      {list.map((course) => {
                        const canceled = course.state === CourseState.Canceled;
                        const live = isLive(course, now);
                        return (
                          <li key={course.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(course)}
                              aria-current={live ? "time" : undefined}
                              className={`flex w-full gap-3 rounded-2xl p-3 text-left transition-shadow hover:shadow-md ${
                                canceled ? "opacity-60" : ""
                              } ${live ? "bg-primary/5 ring-2 ring-primary" : "bg-background"}`}
                            >
                              <span
                                aria-hidden
                                className="w-1 shrink-0 rounded-full bg-primary"
                                style={course.color ? { backgroundColor: course.color } : undefined}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium tabular-nums text-foreground/50">
                                  {formatTime(course.from, locale)} – {formatTime(course.to, locale)}
                                </span>
                                <span className={`block font-medium wrap-anywhere ${canceled ? "line-through" : ""}`}>
                                  {course.subject}
                                </span>
                                <span className="block truncate text-sm text-foreground/50">
                                  {[course.room, course.teacher].filter(Boolean).join(" · ")}
                                </span>
                                <span className="mt-1 block">
                                  <Badge course={course} />
                                </span>
                                {live && <LiveProgress from={course.from} to={course.to} now={now} />}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
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
