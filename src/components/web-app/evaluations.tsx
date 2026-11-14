"use client";

import { useState } from "react";
import type { EvaluationDTO, PeriodsDTO } from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { formatDay } from "./format";
import { Async, PageHeader, PeriodSelect } from "./ui";

export function WebAppEvaluations() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("evaluationPeriods");
  const [chosen, setChosen] = useState<string | null>(null);
  const periodId = chosen ?? periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const state = useApi<EvaluationDTO[]>(periodId ? "evaluations" : null, { periodId });

  return (
    <>
      <PageHeader title={t.nav.evaluations}>
        {periods.data && periodId && <PeriodSelect periods={periods.data.periods} value={periodId} onChange={setChosen} />}
      </PageHeader>
      <Async state={after(periods, state, [])} empty={t.evaluations.none} isEmpty={(list) => !list.length}>
        {(list) => (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3">
            {list.map((evaluation) => (
              <article key={evaluation.id} className="min-w-0 rounded-xl border border-foreground/10 bg-surface p-3 text-sm sm:p-4 sm:text-base">
                <p className="mb-1 font-mono text-xs tracking-widest text-foreground/50 uppercase">
                  {formatDay(evaluation.date, locale)}
                </p>
                <h2 className="font-semibold wrap-anywhere">{evaluation.name}</h2>
                <p className="text-sm text-foreground/50">
                  {[evaluation.subject, evaluation.teacher].filter(Boolean).join(" · ")}
                </p>
                {evaluation.description && <p className="mt-2 text-foreground/80">{evaluation.description}</p>}
                <ul className="mt-3 flex flex-col gap-2">
                  {evaluation.skills.map((skill, index) => (
                    <li key={index} className="flex flex-col items-start gap-2 rounded-lg bg-background p-2 sm:flex-row sm:gap-3 sm:p-3">
                      <span
                        title={skill.level}
                        className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md bg-primary px-1.5 font-mono text-xs font-semibold text-white"
                      >
                        {skill.abbreviation || "–"}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium wrap-anywhere">{skill.name}</span>
                        <span className="block text-sm text-foreground/50">{skill.level}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
