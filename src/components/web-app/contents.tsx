"use client";

import { useMemo, useState } from "react";
import type { LessonContentDTO } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, endOfDay, formatDay, formatTime, startOfWeek } from "./format";
import { Async, Attachments, Html, PageHeader, SubjectDot, WeekNav } from "./ui";

export function WebAppContents() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const range = useMemo(() => ({ from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() }), [week]);
  const state = useApi<LessonContentDTO[]>("lessonContents", range);

  return (
    <>
      <PageHeader title={t.nav.contents}>
        <WeekNav week={week} onChange={setWeek} />
      </PageHeader>
      <Async state={state} empty={t.contents.none} isEmpty={(list) => !list.length}>
        {(list) => (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((lesson) => (
              <article key={lesson.id} className="min-w-0 rounded-xl border border-foreground/10 bg-surface p-4">
                <p className="mb-1 font-mono text-xs tracking-widest text-foreground/50 uppercase">
                  {formatDay(lesson.date, locale)} · {formatTime(lesson.date, locale)}
                </p>
                <h2 className="flex items-center gap-2 font-semibold">
                  <SubjectDot color={lesson.color} />
                  <span className="min-w-0 wrap-anywhere">{lesson.subject}</span>
                </h2>
                {lesson.teachers.length > 0 && <p className="text-sm text-foreground/50">{lesson.teachers.join(", ")}</p>}
                <div className="mt-3 flex flex-col gap-3">
                  {lesson.contents.map((content, index) => (
                    <div key={index} className="rounded-lg bg-background p-3">
                      {content.title && <p className="mb-1 font-medium">{content.title}</p>}
                      {content.description && <Html html={content.description} className="text-foreground/80" />}
                      <Attachments files={content.attachments} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
