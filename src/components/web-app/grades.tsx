"use client";

import { ChevronDown } from "@getpapillon/papicons";
import { useState } from "react";
import type { GradeDTO, GradesDTO, PeriodsDTO, SubjectDTO } from "@/lib/pronote/types";
import { overallAverage } from "@/lib/pronote/average";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { formatScore, formatShortDate } from "./format";
import { Async, Attachments, Dialog, PageHeader, PeriodSelect, SubjectDot } from "./ui";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-foreground/50">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function GradeDetail({ grade, subject, onClose }: { grade: GradeDTO; subject: SubjectDTO; onClose: () => void }) {
  const { t, locale } = useWebApp();
  const files = [grade.subjectFile, grade.correctionFile].filter((file) => file !== undefined);

  return (
    <Dialog title={grade.description || subject.name} onClose={onClose}>
      <p className="mb-4 flex items-center gap-2 text-foreground/60">
        <SubjectDot color={subject.color} />
        {subject.name}
        {grade.date && ` · ${formatShortDate(grade.date, locale)}`}
      </p>
      <p className="mb-6 text-5xl font-semibold tabular-nums text-primary">
        {formatScore(grade.value, locale)}
        <span className="text-2xl text-foreground/40">/{formatScore(grade.outOf, locale)}</span>
      </p>
      <div className="grid grid-cols-2 gap-4 rounded-2xl bg-surface p-4 sm:grid-cols-4">
        <Stat label={t.grades.class} value={formatScore(grade.average, locale)} />
        <Stat label={t.grades.min} value={formatScore(grade.min, locale)} />
        <Stat label={t.grades.max} value={formatScore(grade.max, locale)} />
        <Stat label={t.grades.coefficient} value={String(grade.coefficient)} />
      </div>
      <div className="mt-4 flex gap-2">
        {grade.bonus && <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{t.grades.bonus}</span>}
        {grade.optional && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{t.grades.optional}</span>
        )}
      </div>
      <Attachments files={files} />
    </Dialog>
  );
}

function SubjectCard({ subject, onPick }: { subject: SubjectDTO; onPick: (grade: GradeDTO) => void }) {
  const { t, locale } = useWebApp();
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-3xl bg-surface p-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-foreground/5"
      >
        <SubjectDot color={subject.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{subject.name}</span>
          <span className="block text-sm text-foreground/50">
            {t.grades.class} {formatScore(subject.classAverage, locale)} · {t.grades.min}{" "}
            {formatScore(subject.min, locale)} · {t.grades.max} {formatScore(subject.max, locale)}
          </span>
        </span>
        <span className="text-xl font-semibold tabular-nums">{formatScore(subject.average, locale)}</span>
        <ChevronDown className={`size-5 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && subject.grades.length > 0 && (
        <ul className="flex flex-col gap-1 p-1">
          {subject.grades.map((grade) => (
            <li key={grade.id}>
              <button
                type="button"
                onClick={() => onPick(grade)}
                className="flex w-full items-center gap-3 rounded-2xl bg-background px-4 py-3 text-left transition-shadow hover:shadow-md"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{grade.description || subject.name}</span>
                  <span className="block text-sm text-foreground/50">
                    {grade.date && formatShortDate(grade.date, locale)} · {t.grades.coefficient} {grade.coefficient}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatScore(grade.value, locale)}
                  <span className="text-sm font-normal text-foreground/40">/{formatScore(grade.outOf, locale)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WebAppGrades() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("gradePeriods");
  const [chosen, setChosen] = useState<string | null>(null);
  const periodId = chosen ?? periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const grades = useApi<GradesDTO>(periodId ? "grades" : null, { periodId });
  const [selected, setSelected] = useState<{ grade: GradeDTO; subject: SubjectDTO } | null>(null);

  return (
    <>
      <PageHeader title={t.nav.grades}>
        {periods.data && periodId && (
          <PeriodSelect periods={periods.data.periods} value={periodId} onChange={setChosen} />
        )}
      </PageHeader>
      <Async state={after(periods, grades, { overall: { value: null }, classOverall: { value: null }, subjects: [] })} empty={t.grades.noGrades} isEmpty={(data) => !data.subjects.length}>
        {(data) => {
          const official = data.overall.value !== null;
          const overall = official ? data.overall : { value: overallAverage(data.subjects) };
          return (
            <>
              <div className="mb-6 flex flex-wrap items-end gap-8 rounded-3xl bg-primary p-6 text-white">
                <div>
                  <p className="text-white/70">{t.grades.overall}</p>
                  <p className="text-6xl font-semibold tabular-nums">
                    {formatScore(overall, locale)}
                    <span className="text-2xl text-white/60">/20</span>
                  </p>
                  {!official && overall.value !== null && <p className="mt-1 text-sm text-white/70">{t.grades.computed}</p>}
                </div>
                {data.classOverall.value !== null && (
                  <div>
                    <p className="text-white/70">{t.grades.class}</p>
                    <p className="text-3xl font-semibold tabular-nums">{formatScore(data.classOverall, locale)}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {data.subjects.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} onPick={(grade) => setSelected({ grade, subject })} />
                ))}
              </div>
            </>
          );
        }}
      </Async>
      {selected && (
        <GradeDetail grade={selected.grade} subject={selected.subject} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
