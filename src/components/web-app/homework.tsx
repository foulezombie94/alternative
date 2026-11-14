"use client";

import { Add, Check, Clock } from "@getpapillon/papicons";
import { useMemo, useState } from "react";
import type { HomeworkDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { addDays, endOfDay, formatDay, startOfWeek } from "./format";
import { Async, Attachments, Html, PageHeader, SubjectDot, RangeToggle, WeekNav } from "./ui";

const pageSize = 30;

function HomeworkCard({
  homework,
  onToggle,
  withYear,
}: {
  homework: HomeworkDTO;
  onToggle: (done: boolean) => void;
  withYear: boolean;
}) {
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
    <article className={`flex min-w-0 flex-col gap-2 rounded-xl border border-foreground/10 bg-surface p-3 text-sm sm:flex-row sm:gap-3 sm:p-4 sm:text-base transition-opacity ${homework.done ? "opacity-60" : ""}`}>
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
          <span className="min-w-0">{formatDay(homework.dueDate, locale, withYear)}</span>
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
  const [everything, setEverything] = useState(false);
  const [shown, setShown] = useState(pageSize);
  const range = useMemo(() => {
    if (!everything) return { from: week.toISOString(), to: endOfDay(addDays(week, 6)).toISOString() };
    const today = endOfDay(new Date());
    return { from: addDays(today, -365).toISOString(), to: addDays(today, 365).toISOString() };
  }, [week, everything]);
  const state = useApi<HomeworkDTO[]>("homeworks", range);

  return (
    <>
      <PageHeader title={t.nav.homework}>
        <RangeToggle
          everything={everything}
          onChange={(value) => {
            setEverything(value);
            setShown(pageSize);
          }}
        />
        {!everything && <WeekNav week={week} onChange={setWeek} />}
      </PageHeader>
      <Async state={state} empty={t.homework.noHomework} isEmpty={(list) => !list.length}>
        {(list) => {
          const done = list.filter((homework) => homework.done).length;
          const today = new Date().setHours(0, 0, 0, 0);
          const upcoming = list.filter((homework) => new Date(homework.dueDate).getTime() >= today);
          const past = list.filter((homework) => new Date(homework.dueDate).getTime() < today).reverse();
          const ordered = everything ? [...upcoming, ...past] : list;
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
              <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                {ordered.slice(0, everything ? shown : undefined).map((homework) => (
                  <HomeworkCard
                    key={homework.id}
                    homework={homework}
                    withYear={everything}
                    onToggle={(value) =>
                      state.update(list.map((item) => (item.id === homework.id ? { ...item, done: value } : item)))
                    }
                  />
                ))}
              </div>
              {everything && ordered.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((value) => value + pageSize)}
                  className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-surface px-5 py-2 text-sm font-medium transition-colors hover:border-foreground/30"
                >
                  <Add aria-hidden className="size-4" />
                  {ordered.length - shown} {t.attendance.more}
                </button>
              )}
            </>
          );
        }}
      </Async>
    </>
  );
}
