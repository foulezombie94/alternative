"use client";

import { Check, Clock } from "@getpapillon/papicons";
import { useMemo, useState } from "react";
import type { HomeworkDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, endOfDay, formatDay, startOfWeek } from "./format";
import { Async, Attachments, Html, PageHeader, SubjectDot, WeekNav } from "./ui";

function HomeworkCard({ homework, onToggle }: { homework: HomeworkDTO; onToggle: (done: boolean) => void }) {
  const { t, locale } = useWebApp();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await call("setHomeworkDone", { id: homework.id, done: !homework.done });
      onToggle(!homework.done);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`flex min-w-0 gap-3 rounded-xl border border-foreground/10 bg-surface p-4 transition-opacity ${homework.done ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-label={homework.done ? t.homework.markUndone : t.homework.markDone}
        aria-pressed={homework.done}
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          homework.done ? "border-primary bg-primary text-white" : "border-foreground/20 hover:border-primary"
        }`}
      >
        {homework.done && <Check className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-center justify-between gap-2 font-mono text-xs tracking-widest text-foreground/50 uppercase">
          <span className="truncate">{formatDay(homework.dueDate, locale)}</span>
          {homework.minutes ? (
            <span className="flex shrink-0 items-center gap-1 tracking-normal normal-case">
              <Clock className="size-3.5" />
              {homework.minutes} {t.common.minutes}
            </span>
          ) : null}
        </p>
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <SubjectDot color={homework.color} />
          <span className="min-w-0 wrap-anywhere">{homework.subject}</span>
        </h3>
        <Html html={homework.content} className={`text-foreground/80 ${homework.done ? "line-through" : ""}`} />
        {homework.uploadRequired && (
          <p className="mt-2 inline-block rounded-md bg-feature-homework/10 px-3 py-1 text-sm font-medium text-feature-homework">
            {t.homework.upload}
          </p>
        )}
        <Attachments files={homework.attachments} />
      </div>
    </article>
  );
}

export function WebAppHomework() {
  const { t } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const range = useMemo(
    () => ({ from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() }),
    [week],
  );
  const state = useApi<HomeworkDTO[]>("homeworks", range);

  return (
    <>
      <PageHeader title={t.nav.homework}>
        <WeekNav week={week} onChange={setWeek} />
      </PageHeader>
      <Async state={state} empty={t.homework.noHomework} isEmpty={(list) => !list.length}>
        {(list) => {
          const done = list.filter((homework) => homework.done).length;
          return (
            <>
              <div className="mb-5 rounded-xl border border-foreground/10 bg-surface px-5 py-3">
                <p className="mb-2 font-medium">
                  {done}/{list.length} {t.homework.progress}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${(done / list.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {list.map((homework) => (
                  <HomeworkCard
                    key={homework.id}
                    homework={homework}
                    onToggle={(value) =>
                      state.update(list.map((item) => (item.id === homework.id ? { ...item, done: value } : item)))
                    }
                  />
                ))}
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
