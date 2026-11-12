"use client";

import { Check, Clock } from "@getpapillon/papicons";
import { useMemo, useState } from "react";
import type { HomeworkDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, capitalize, dayKey, endOfDay, formatDay, startOfWeek } from "./format";
import { Async, Attachments, Html, PageHeader, SubjectDot, WeekNav } from "./ui";

function HomeworkCard({ homework, onToggle }: { homework: HomeworkDTO; onToggle: (done: boolean) => void }) {
  const { t } = useWebApp();
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
    <article className={`flex gap-4 rounded-3xl bg-surface p-5 transition-opacity ${homework.done ? "opacity-60" : ""}`}>
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
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <SubjectDot color={homework.color} />
          <h3 className="font-semibold">{homework.subject}</h3>
          {homework.minutes ? (
            <span className="flex items-center gap-1 text-sm text-foreground/50">
              <Clock className="size-4" />
              {homework.minutes} {t.common.minutes}
            </span>
          ) : null}
        </div>
        <Html html={homework.content} className={`text-foreground/80 ${homework.done ? "line-through" : ""}`} />
        {homework.uploadRequired && (
          <p className="mt-2 inline-block rounded-full bg-feature-homework/10 px-3 py-1 text-sm font-medium text-feature-homework">
            {t.homework.upload}
          </p>
        )}
        <Attachments files={homework.attachments} />
      </div>
    </article>
  );
}

export function WebAppHomework() {
  const { t, locale } = useWebApp();
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
          const groups = new Map<string, { date: Date; items: HomeworkDTO[] }>();
          for (const homework of list) {
            const date = new Date(homework.dueDate);
            const key = dayKey(date);
            if (!groups.has(key)) groups.set(key, { date, items: [] });
            groups.get(key)?.items.push(homework);
          }

          return (
            <>
              <div className="mb-6 rounded-3xl bg-surface p-5">
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
              <div className="flex flex-col gap-8">
                {[...groups.values()].map(({ date, items }) => (
                  <section key={dayKey(date)}>
                    <h2 className="mb-3 text-lg font-semibold">
                      {capitalize(formatDay(date, locale))}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {items.map((homework) => (
                        <HomeworkCard
                          key={homework.id}
                          homework={homework}
                          onToggle={(value) =>
                            state.update(list.map((item) => (item.id === homework.id ? { ...item, done: value } : item)))
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
