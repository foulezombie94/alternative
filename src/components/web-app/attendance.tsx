"use client";

import { Add, Cross, Filter } from "@getpapillon/papicons";
import { Children, type ReactNode, useState } from "react";
import type { AttendanceDTO, PeriodsDTO } from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatDuration, formatTime } from "./format";
import { Async, PageHeader, PeriodSelect } from "./ui";

const previewCount = 4;

type Kind = "absences" | "delays" | "punishments" | "observations";
type Status = "all" | "justified" | "notJustified";
type Order = "newest" | "oldest";
type Nature = "all" | "positive" | "negative";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useWebApp();
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hidden = items.length - previewCount;

  return (
    <section className="rounded-xl border border-foreground/10 bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-mono text-xs font-medium tracking-widest text-foreground/50 uppercase">
        {title}
        <span className="rounded-md bg-foreground/10 px-2.5 text-sm">
          {items.length}
        </span>
      </h2>
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {expanded ? items : items.slice(0, previewCount)}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/10 px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          {!expanded && <Add aria-hidden className="size-4" />}
          {expanded ? t.attendance.showLess : `${hidden} ${t.attendance.more}`}
        </button>
      )}
    </section>
  );
}

function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 font-mono text-xs font-medium tracking-widest text-foreground/50 uppercase">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              value === option.id
                ? "border-primary bg-primary text-white"
                : "border-foreground/10 bg-surface text-foreground/70 hover:border-foreground/30"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Item({
  title,
  detail,
  tag,
  tone,
}: {
  title: string;
  detail?: ReactNode;
  tag?: string;
  tone?: "good" | "bad";
}) {
  return (
    <li className="rounded-lg bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        {tag && (
          <span
            className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${
              tone === "good"
                ? "bg-primary/10 text-primary"
                : "bg-feature-schedule/10 text-feature-schedule"
            }`}
          >
            {tag}
          </span>
        )}
      </div>
      {detail && (
        <div className="mt-1 text-sm text-foreground/60">{detail}</div>
      )}
    </li>
  );
}

export function WebAppAttendance() {
  const { t, locale } = useWebApp();
  const periods = useApi<PeriodsDTO>("attendancePeriods");
  const [chosen, setChosen] = useState<string | null>(null);
  const periodId =
    chosen ?? periods.data?.defaultId ?? periods.data?.periods.at(-1)?.id;
  const state = useApi<AttendanceDTO>(periodId ? "attendance" : null, {
    periodId,
  });
  const units = { hours: t.common.hours, minutes: t.common.minutes };
  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status>("all");
  const [order, setOrder] = useState<Order>("newest");
  const [nature, setNature] = useState<Nature>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const active = [
    kind !== "all" && {
      label: t.attendance[kind],
      clear: () => setKind("all"),
    },
    status !== "all" && {
      label: t.common[status],
      clear: () => setStatus("all"),
    },
    nature !== "all" && {
      label:
        nature === "positive"
          ? t.attendance.encouragements
          : t.attendance.remarks,
      clear: () => setNature("all"),
    },
    order !== "newest" && {
      label: t.attendance.oldest,
      clear: () => setOrder("newest"),
    },
  ].filter((filter) => filter !== false);
  const reset = () => {
    setKind("all");
    setStatus("all");
    setNature("all");
    setOrder("newest");
  };
  const chooseKind = (value: Kind | "all") => {
    setKind(value);
    if (value === "observations" || value === "punishments") setStatus("all");
    if (value !== "observations") setNature("all");
  };

  const sorted = <T,>(list: T[], date: (item: T) => string) =>
    [...list].sort((a, b) =>
      order === "newest"
        ? date(b).localeCompare(date(a))
        : date(a).localeCompare(date(b)),
    );
  const matches = (justified: boolean) =>
    status === "all" || justified === (status === "justified");
  const shows = (section: Kind) =>
    (kind === "all" || kind === section) &&
    (status === "all" || section === "absences" || section === "delays") &&
    (nature === "all" || section === "observations");

  return (
    <>
      <PageHeader title={t.nav.attendance}>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="attendance-filters"
          onClick={() => setFiltersOpen((value) => !value)}
          className={`flex items-center gap-2 rounded-md border px-4 py-2 font-medium transition-colors ${
            filtersOpen || active.length
              ? "border-primary bg-primary text-white"
              : "border-foreground/10 bg-surface hover:border-foreground/30"
          }`}
        >
          <Filter aria-hidden className="size-4" />
          {t.attendance.filter}
          {active.length > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white tabular-nums">
              {active.length}
            </span>
          )}
        </button>
        {periods.data && periodId && (
          <PeriodSelect
            periods={periods.data.periods}
            value={periodId}
            onChange={setChosen}
          />
        )}
      </PageHeader>

      {filtersOpen && (
        <div
          id="attendance-filters"
          className="mb-5 rounded-xl border border-foreground/10 bg-surface p-5"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Chips
              label={t.attendance.filterKind}
              value={kind}
              onChange={chooseKind}
              options={[
                { id: "all", label: t.attendance.all },
                { id: "absences", label: t.attendance.absences },
                { id: "delays", label: t.attendance.delays },
                { id: "punishments", label: t.attendance.punishments },
                { id: "observations", label: t.attendance.observations },
              ]}
            />
            {kind === "observations" ? (
              <Chips
                label={t.attendance.filterNature}
                value={nature}
                onChange={setNature}
                options={[
                  { id: "all", label: t.attendance.allStatus },
                  { id: "positive", label: t.attendance.encouragements },
                  { id: "negative", label: t.attendance.remarks },
                ]}
              />
            ) : kind === "punishments" ? null : (
              <Chips
                label={t.attendance.filterStatus}
                value={status}
                onChange={setStatus}
                options={[
                  { id: "all", label: t.attendance.allStatus },
                  { id: "notJustified", label: t.common.notJustified },
                  { id: "justified", label: t.common.justified },
                ]}
              />
            )}
            <Chips
              label={t.attendance.order}
              value={order}
              onChange={setOrder}
              options={[
                { id: "newest", label: t.attendance.newest },
                { id: "oldest", label: t.attendance.oldest },
              ]}
            />
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {active.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={filter.clear}
              aria-label={`${t.attendance.removeFilter} ${filter.label}`}
              className="flex items-center gap-1.5 rounded-md border border-foreground/10 bg-surface py-1 pr-2 pl-3 text-sm font-medium transition-colors hover:border-foreground/30"
            >
              {filter.label}
              <Cross aria-hidden className="size-3.5 text-foreground/50" />
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="px-2 text-sm font-medium text-foreground/50 underline hover:text-foreground"
          >
            {t.attendance.reset}
          </button>
        </div>
      )}

      <Async
        state={after(periods, state, {
          absences: [],
          delays: [],
          punishments: [],
          observations: [],
        })}
        empty={t.attendance.nothing}
        isEmpty={(data) =>
          !data.absences.length &&
          !data.delays.length &&
          !data.punishments.length &&
          !data.observations.length
        }
      >
        {(data) => (
          <>
            <div
              className={`grid grid-cols-1 gap-4 ${kind === "all" ? "lg:grid-cols-2" : ""}`}
            >
              {shows("absences") && (
                <Section title={t.attendance.absences}>
                  {sorted(
                    data.absences.filter((absence) =>
                      matches(absence.justified),
                    ),
                    (absence) => absence.from,
                  ).map((absence) => (
                    <Item
                      key={absence.id}
                      title={`${capitalize(formatDay(absence.from, locale))} · ${formatDuration(absence.minutes, units)}`}
                      detail={
                        <>
                          {t.attendance.from} {formatTime(absence.from, locale)}{" "}
                          {t.attendance.to} {formatTime(absence.to, locale)}
                          {absence.reason && ` · ${absence.reason}`}
                        </>
                      }
                      tag={
                        absence.justified
                          ? t.common.justified
                          : t.common.notJustified
                      }
                      tone={absence.justified ? "good" : "bad"}
                    />
                  ))}
                </Section>
              )}
              {shows("delays") && (
                <Section title={t.attendance.delays}>
                  {sorted(
                    data.delays.filter((delay) => matches(delay.justified)),
                    (delay) => delay.date,
                  ).map((delay) => (
                    <Item
                      key={delay.id}
                      title={`${capitalize(formatDay(delay.date, locale))} ${t.attendance.at} ${formatTime(delay.date, locale)} · ${delay.minutes} ${t.common.minutes}`}
                      detail={delay.reason}
                      tag={
                        delay.justified
                          ? t.common.justified
                          : t.common.notJustified
                      }
                      tone={delay.justified ? "good" : "bad"}
                    />
                  ))}
                </Section>
              )}
              {shows("punishments") && (
                <Section title={t.attendance.punishments}>
                  {sorted(
                    data.punishments,
                    (punishment) => punishment.date,
                  ).map((punishment) => (
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
                          {punishment.circumstances && (
                            <p>{punishment.circumstances}</p>
                          )}
                          {punishment.work && (
                            <p>
                              {t.attendance.work} : {punishment.work}
                            </p>
                          )}
                        </div>
                      }
                      tag={
                        punishment.exclusion
                          ? t.attendance.exclusion
                          : formatDuration(punishment.minutes, units)
                      }
                      tone="bad"
                    />
                  ))}
                </Section>
              )}
              {shows("observations") && (
                <Section title={t.attendance.observations}>
                  {sorted(
                    data.observations.filter(
                      (observation) =>
                        nature === "all" ||
                        observation.positive === (nature === "positive"),
                    ),
                    (observation) => observation.date,
                  ).map((observation) => (
                    <Item
                      key={observation.id}
                      title={observation.name}
                      detail={[
                        capitalize(formatDay(observation.date, locale)),
                        observation.subject,
                        observation.reason,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      tag={
                        observation.positive
                          ? t.attendance.encouragement
                          : undefined
                      }
                      tone="good"
                    />
                  ))}
                </Section>
              )}
            </div>
          </>
        )}
      </Async>
    </>
  );
}
