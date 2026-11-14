"use client";

import { Add, Search } from "@getpapillon/papicons";
import { useMemo, useState } from "react";
import type { LessonContentDTO } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, endOfDay, formatDay, formatTime, startOfWeek } from "./format";
import { Async, Attachments, Empty, Html, PageHeader, SubjectDot, RangeToggle, WeekNav } from "./ui";

const pageSize = 30;

const control =
  "rounded-md border border-foreground/10 bg-surface px-4 py-2 font-medium outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary";

function plain(text: string | undefined) {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function WebAppContents() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [everything, setEverything] = useState(false);
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(pageSize);

  const range = useMemo(() => {
    if (!everything) return { from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() };
    const today = endOfDay(new Date());
    return { from: addDays(today, -365).toISOString(), to: today.toISOString() };
  }, [week, everything]);
  const state = useApi<LessonContentDTO[]>("lessonContents", range);

  const subjects = useMemo(
    () => [...new Set((state.data ?? []).map((lesson) => lesson.subject))].sort((a, b) => a.localeCompare(b, locale)),
    [state.data, locale],
  );
  const activeSubject = subjects.includes(subject) ? subject : "";

  const filtered = useMemo(() => {
    const words = plain(search).split(/\s+/).filter(Boolean);
    return (state.data ?? []).filter((lesson) => {
      if (activeSubject && lesson.subject !== activeSubject) return false;
      if (!words.length) return true;
      const text = plain(
        [
          lesson.subject,
          lesson.teachers.join(" "),
          ...lesson.contents.flatMap((content) => [
            content.title,
            content.description,
            ...content.attachments.map((file) => file.name),
          ]),
        ].join(" "),
      );
      return words.every((word) => text.includes(word));
    });
  }, [state.data, activeSubject, search]);

  return (
    <>
      <PageHeader title={t.nav.contents}>
        <RangeToggle
          everything={everything}
          onChange={(value) => {
            setEverything(value);
            setShown(pageSize);
          }}
        />
        {!everything && <WeekNav week={week} onChange={setWeek} />}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">{t.contents.search}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShown(pageSize);
            }}
            placeholder={t.contents.search}
            className={`${control} w-full pl-9 font-normal placeholder:text-foreground/40`}
          />
        </label>
        <label className="max-sm:w-full">
          <span className="sr-only">{t.contents.subject}</span>
          <select
            value={activeSubject}
            onChange={(event) => {
              setSubject(event.target.value);
              setShown(pageSize);
            }}
            className={`${control} max-w-full cursor-pointer max-sm:w-full`}
          >
            <option value="">{t.contents.allSubjects}</option>
            {subjects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {state.data && (
          <p className="px-1 text-sm text-foreground/50 tabular-nums">
            {filtered.length} {t.contents.results}
          </p>
        )}
      </div>

      <Async state={state} empty={t.contents.none} isEmpty={(list) => !list.length}>
        {() =>
          filtered.length ? (
            <>
              <div className="grid grid-cols-2 items-start gap-2 sm:gap-3 xl:grid-cols-3">
                {filtered.slice(0, shown).map((lesson) => (
                  <article key={lesson.id} className="min-w-0 rounded-xl border border-foreground/10 bg-surface p-3 text-sm sm:p-4 sm:text-base">
                    <p className="mb-1 font-mono text-xs tracking-widest text-foreground/50 uppercase">
                      {formatDay(lesson.date, locale, everything)} · {formatTime(lesson.date, locale)}
                    </p>
                    <h2 className="flex items-center gap-2 font-semibold">
                      <SubjectDot color={lesson.color} />
                      <span className="min-w-0 wrap-anywhere">{lesson.subject}</span>
                    </h2>
                    {lesson.teachers.length > 0 && <p className="text-sm text-foreground/50">{lesson.teachers.join(", ")}</p>}
                    <div className="mt-3 flex flex-col gap-3">
                      {lesson.contents.map((content, index) => (
                        <div key={index} className="rounded-lg bg-background p-2 sm:p-3">
                          {content.title && <p className="mb-1 font-medium">{content.title}</p>}
                          {content.description && <Html html={content.description} className="text-foreground/80" />}
                          <Attachments files={content.attachments} />
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              {filtered.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((value) => value + pageSize)}
                  className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-surface px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30"
                >
                  <Add aria-hidden className="size-4" />
                  {filtered.length - shown} {t.attendance.more}
                </button>
              )}
            </>
          ) : (
            <Empty>{t.contents.noMatch}</Empty>
          )
        }
      </Async>
    </>
  );
}
