"use client";

import { useState } from "react";
import type { PeriodsDTO, ReportCardDTO } from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { formatScore } from "./format";
import { Async, Empty, PageHeader, PeriodSelect } from "./ui";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="font-mono text-xs tracking-widest text-foreground/50 uppercase">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

export function WebAppReport() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("reportCardPeriods");
  const [chosen, setChosen] = useState<string | null>(null);
  const periodId = chosen ?? periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const report = useApi<ReportCardDTO>(periodId ? "reportCard" : null, { periodId });

  return (
    <>
      <PageHeader title={t.nav.report}>
        {periods.data && periodId && <PeriodSelect periods={periods.data.periods} value={periodId} onChange={setChosen} />}
      </PageHeader>
      <Async state={after(periods, report, { subjects: [], overall: [] })}>
        {(data) => (
          <>
            {data.message && (
              <p className="mb-4 rounded-xl border border-foreground/10 bg-surface p-5 text-center font-medium">{data.message}</p>
            )}
            {!data.message && !data.subjects.length && <Empty>{t.report.none}</Empty>}
            {data.raw && data.raw !== "{}" && data.raw !== "null" && (
              <details className="mx-auto max-w-2xl text-sm text-foreground/50">
                <summary className="cursor-pointer text-center underline">{t.news.diagnostic}</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-foreground/10 bg-surface p-3 text-xs whitespace-pre-wrap select-all">
                  {data.raw}
                </pre>
              </details>
            )}
            {data.subjects.length > 0 && (
              <ul className="overflow-hidden rounded-xl border border-foreground/10 bg-surface">
                {data.subjects.map((subject, index) => (
                  <li key={`${subject.name}-${index}`} className="border-b border-foreground/10 p-4 last:border-b-0">
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                      <div className="min-w-0">
                        <p className="font-semibold wrap-anywhere">{subject.name}</p>
                        {subject.teachers.length > 0 && (
                          <p className="text-sm text-foreground/50">{subject.teachers.join(", ")}</p>
                        )}
                      </div>
                      <div className="flex gap-5">
                        <div className="text-right">
                          <p className="font-mono text-xs tracking-widest text-foreground/50 uppercase">{t.report.average}</p>
                          <p className="text-xl font-semibold tabular-nums">{formatScore(subject.average, locale)}</p>
                        </div>
                        <Stat label={t.grades.class} value={formatScore(subject.classAverage, locale)} />
                        <Stat label={t.grades.min} value={formatScore(subject.min, locale)} />
                        <Stat label={t.grades.max} value={formatScore(subject.max, locale)} />
                      </div>
                    </div>
                    {subject.assessments.map((assessment, line) => (
                      <p key={line} className="mt-2 rounded-lg bg-background p-3 text-foreground/80">
                        {assessment}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {data.overall.map((entry) => (
              <div key={entry.name} className="mt-4 rounded-xl border border-foreground/10 bg-surface p-5">
                <p className="mb-2 font-mono text-xs tracking-widest text-foreground/50 uppercase">{entry.name}</p>
                <p>{entry.value}</p>
              </div>
            ))}
          </>
        )}
      </Async>
    </>
  );
}
