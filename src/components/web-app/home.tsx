"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";
import type { CourseDTO, Feature, GradesDTO, HomeworkDTO, NewsDTO, PeriodsDTO } from "@/lib/pronote/types";
import { CourseState } from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, capitalize, endOfDay, formatDay, formatScore, formatShortDate, formatTime, sameDay } from "./format";
import { Async, isLive, LiveProgress, Panel, SubjectDot, useNow } from "./ui";

function SeeAll({ path }: { path: string }) {
  const { t, locale } = useWebApp();
  return (
    <Link href={`/${locale}/app/${path}` as Route} className="text-sm font-medium text-primary hover:underline">
      {t.common.seeAll}
    </Link>
  );
}

function Courses() {
  const { t, locale } = useWebApp();
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: endOfDay(addDays(from, 14)).toISOString() };
  }, []);
  const state = useApi<CourseDTO[]>("timetable", range);
  const clock = useNow();

  return (
    <Panel title={t.home.nextCourses} action={<SeeAll path="timetable" />}>
      <Async state={state} empty={t.home.noCourses} isEmpty={(courses) => !courses.length}>
        {(courses) => {
          const now = clock;
          const today = courses.filter((course) => sameDay(new Date(course.from), now) && new Date(course.to) > now);
          const nextDay = today.length
            ? null
            : courses.find((course) => new Date(course.from) > now && course.state !== CourseState.Canceled);
          const list = today.length
            ? today
            : nextDay
              ? courses.filter((course) => sameDay(new Date(course.from), new Date(nextDay.from)))
              : [];

          return (
            <>
              <p className="mb-3 text-sm font-medium text-foreground/50">
                {today.length ? t.home.today : nextDay ? capitalize(formatDay(nextDay.from, locale)) : t.home.noCourses}
              </p>
              <ul className="flex flex-col gap-2">
                {list.map((course) => (
                  <li
                    key={course.id}
                    aria-current={isLive(course, now) ? "time" : undefined}
                    className={`flex items-center gap-3 rounded-2xl p-3 ${
                      course.state === CourseState.Canceled ? "opacity-50" : ""
                    } ${isLive(course, now) ? "bg-primary/5 ring-2 ring-primary" : "bg-background"}`}
                  >
                    <span className="w-12 text-sm font-medium tabular-nums text-foreground/60">
                      {formatTime(course.from, locale)}
                    </span>
                    <SubjectDot color={course.color} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${course.state === CourseState.Canceled ? "line-through" : ""}`}>
                        {course.subject}
                      </p>
                      <p className="truncate text-sm text-foreground/50">
                        {[course.room, course.teacher].filter(Boolean).join(" · ")}
                      </p>
                      {isLive(course, now) && <LiveProgress from={course.from} to={course.to} now={now} />}
                    </div>
                    {course.statusText && (
                      <span className="shrink-0 rounded-full bg-feature-homework/10 px-2.5 py-1 text-xs font-medium text-feature-homework">
                        {course.statusText}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </Async>
    </Panel>
  );
}

function Homework() {
  const { t, locale } = useWebApp();
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: endOfDay(addDays(from, 14)).toISOString() };
  }, []);
  const state = useApi<HomeworkDTO[]>("homeworks", range);

  return (
    <Panel title={t.home.homework} action={<SeeAll path="homework" />}>
      <Async state={state} empty={t.home.noHomework} isEmpty={(list) => !list.some((homework) => !homework.done)}>
        {(list) => (
          <ul className="flex flex-col gap-2">
            {list
              .filter((homework) => !homework.done)
              .slice(0, 5)
              .map((homework) => (
                <li key={homework.id} className="flex items-start gap-3 rounded-2xl bg-background p-3">
                  <span className="mt-1.5">
                    <SubjectDot color={homework.color} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{homework.subject}</p>
                    <p className="line-clamp-2 text-sm text-foreground/60">
                      {homework.content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-foreground/50">{formatShortDate(homework.dueDate, locale)}</span>
                </li>
              ))}
          </ul>
        )}
      </Async>
    </Panel>
  );
}

function Grades() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("gradePeriods");
  const periodId = periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const grades = useApi<GradesDTO>(periodId ? "grades" : null, { periodId });

  const latest = useMemo(
    () =>
      (grades.data?.subjects ?? [])
        .flatMap((subject) => subject.grades.map((grade) => ({ ...grade, subject: subject.name, color: subject.color })))
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 5),
    [grades.data],
  );

  return (
    <Panel title={t.home.lastGrades} action={<SeeAll path="grades" />}>
      <Async state={after(periods, grades, { overall: { value: null }, classOverall: { value: null }, subjects: [] })} empty={t.grades.noGrades} isEmpty={() => !latest.length}>
        {(data) => (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums text-primary">{formatScore(data.overall, locale)}</span>
              <span className="text-foreground/50">/20 · {t.home.average}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {latest.map((grade) => (
                <li key={grade.id} className="flex items-center gap-3 rounded-2xl bg-background p-3">
                  <SubjectDot color={grade.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{grade.subject}</p>
                    <p className="truncate text-sm text-foreground/50">{grade.description}</p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatScore(grade.value, locale)}
                    <span className="text-sm font-normal text-foreground/40">/{formatScore(grade.outOf, locale)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
    </Panel>
  );
}

function News() {
  const { t, locale } = useWebApp();
  const state = useApi<NewsDTO[]>("news");

  return (
    <Panel title={t.nav.news} action={<SeeAll path="news" />}>
      <Async state={state} empty={t.common.empty} isEmpty={(list) => !list.length}>
        {(list) => (
          <ul className="flex flex-col gap-2">
            {list.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-background p-3">
                {!item.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="truncate text-sm text-foreground/50">{item.author}</p>
                </div>
                <span className="shrink-0 text-sm text-foreground/50">{formatShortDate(item.date, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Panel>
  );
}

export function WebAppHome() {
  const { t, locale, profile } = useWebApp();
  const has = (feature: Feature) => profile.features.includes(feature);

  return (
    <>
      <div className="mb-8">
        <p className="text-foreground/50">{capitalize(formatDay(new Date(), locale))}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t.home.greeting} {profile.firstName} 👋
        </h1>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {has("timetable") && <Courses />}
        {has("homework") && <Homework />}
        {has("grades") && <Grades />}
        {has("news") && <News />}
      </div>
    </>
  );
}
