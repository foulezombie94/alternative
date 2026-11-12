"use client";

import { type ReactNode, useState } from "react";
import type { AttendanceDTO, PeriodsDTO } from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatDuration, formatTime } from "./format";
import { Async, PageHeader, PeriodSelect } from "./ui";

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className="rounded-full bg-foreground/10 px-2.5 text-sm">{count}</span>
      </h2>
      {count ? <ul className="flex flex-col gap-2">{children}</ul> : null}
    </section>
  );
}

function Item({ title, detail, tag, tone }: { title: string; detail?: ReactNode; tag?: string; tone?: "good" | "bad" }) {
  return (
    <li className="rounded-2xl bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        {tag && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              tone === "good" ? "bg-primary/10 text-primary" : "bg-feature-schedule/10 text-feature-schedule"
            }`}
          >
            {tag}
          </span>
        )}
      </div>
      {detail && <div className="mt-1 text-sm text-foreground/60">{detail}</div>}
    </li>
  );
}

export function WebAppAttendance() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("attendancePeriods");
  const [chosen, setChosen] = useState<string | null>(null);
  const periodId = chosen ?? periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const state = useApi<AttendanceDTO>(periodId ? "attendance" : null, { periodId });
  const units = { hours: t.common.hours, minutes: t.common.minutes };

  return (
    <>
      <PageHeader title={t.nav.attendance}>
        {periods.data && periodId && (
          <PeriodSelect periods={periods.data.periods} value={periodId} onChange={setChosen} />
        )}
      </PageHeader>
      <Async
        state={after(periods, state, { absences: [], delays: [], punishments: [], observations: [] })}
        empty={t.attendance.nothing}
        isEmpty={(data) => !data.absences.length && !data.delays.length && !data.punishments.length && !data.observations.length}
      >
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={t.attendance.absences} count={data.absences.length}>
              {data.absences.map((absence) => (
                <Item
                  key={absence.id}
                  title={`${capitalize(formatDay(absence.from, locale))} · ${formatDuration(absence.minutes, units)}`}
                  detail={
                    <>
                      {t.attendance.from} {formatTime(absence.from, locale)} {t.attendance.to}{" "}
                      {formatTime(absence.to, locale)}
                      {absence.reason && ` · ${absence.reason}`}
                    </>
                  }
                  tag={absence.justified ? t.common.justified : t.common.notJustified}
                  tone={absence.justified ? "good" : "bad"}
                />
              ))}
            </Section>
            <Section title={t.attendance.delays} count={data.delays.length}>
              {data.delays.map((delay) => (
                <Item
                  key={delay.id}
                  title={`${capitalize(formatDay(delay.date, locale))} · ${delay.minutes} ${t.common.minutes}`}
                  detail={delay.reason}
                  tag={delay.justified ? t.common.justified : t.common.notJustified}
                  tone={delay.justified ? "good" : "bad"}
                />
              ))}
            </Section>
            <Section title={t.attendance.punishments} count={data.punishments.length}>
              {data.punishments.map((punishment) => (
                <Item
                  key={punishment.id}
                  title={`${punishment.nature} · ${capitalize(formatDay(punishment.date, locale))}`}
                  detail={
                    <div className="flex flex-col gap-1">
                      {punishment.givenBy && (
                        <p>
                          {t.attendance.givenBy} {punishment.givenBy}
                        </p>
                      )}
                      {punishment.reason && (
                        <p>
                          {t.attendance.reason} : {punishment.reason}
                        </p>
                      )}
                      {punishment.circumstances && <p>{punishment.circumstances}</p>}
                      {punishment.work && (
                        <p>
                          {t.attendance.work} : {punishment.work}
                        </p>
                      )}
                    </div>
                  }
                  tag={punishment.exclusion ? t.attendance.exclusion : formatDuration(punishment.minutes, units)}
                  tone="bad"
                />
              ))}
            </Section>
            <Section title={t.attendance.observations} count={data.observations.length}>
              {data.observations.map((observation) => (
                <Item
                  key={observation.id}
                  title={observation.name}
                  detail={[capitalize(formatDay(observation.date, locale)), observation.subject, observation.reason]
                    .filter(Boolean)
                    .join(" · ")}
                  tag={observation.positive ? t.attendance.encouragement : undefined}
                  tone="good"
                />
              ))}
            </Section>
          </div>
        )}
      </Async>
    </>
  );
}
