"use client";

import { Add, ChevronDown, Cross, Filter } from "@getpapillon/papicons";
import { Children, type ReactNode, useId, useMemo, useState } from "react";
import {
  type AbsenceDTO,
  type AttendanceDTO,
  type CourseDTO,
  CourseKind,
  CourseState,
  type PeriodsDTO,
} from "@/lib/pronote/types";
import { after, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatDuration, formatTime } from "./format";
import { Async, PageHeader, PeriodSelect } from "./ui";

const delayWindow = 15 * 60 * 1000;

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

function Face({ happy }: { happy: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`size-7 shrink-0 ${happy ? "text-impact-up" : "text-impact-down"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" className="fill-current/10" />
      <circle cx="8.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
      <path
        d={
          happy
            ? "M7.5 14.5c1.2 1.6 2.7 2.4 4.5 2.4s3.3-.8 4.5-2.4"
            : "M7.5 17c1.2-1.6 2.7-2.4 4.5-2.4s3.3.8 4.5 2.4"
        }
      />
    </svg>
  );
}

function Item({
  title,
  detail,
  tag,
  tone,
  icon,
  expand,
}: {
  title: string;
  detail?: ReactNode;
  tag?: string;
  tone?: "good" | "bad";
  icon?: ReactNode;
  expand?: () => ReactNode;
}) {
  const { t } = useWebApp();
  const [open, setOpen] = useState(false);
  const panel = useId();

  const header = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
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
      </div>
      {expand && (
        <ChevronDown
          aria-hidden
          className={`mt-1 size-4 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      )}
    </>
  );

  if (!expand)
    return (
      <li className="flex gap-3 rounded-lg bg-background p-4">{header}</li>
    );

  return (
    <li className="rounded-lg bg-background">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        title={open ? t.attendance.hideDetails : t.attendance.showDetails}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full gap-3 rounded-lg p-4 text-left transition-colors hover:bg-foreground/5"
      >
        {header}
      </button>
      {open && (
        <div
          id={panel}
          className="border-t border-foreground/10 px-4 pt-3 pb-4"
        >
          {expand()}
        </div>
      )}
    </li>
  );
}

function Lesson({ course }: { course: CourseDTO }) {
  const { t, locale } = useWebApp();
  const canceled = course.state === CourseState.Canceled;
  return (
    <li
      className={`flex gap-3 rounded-md border border-foreground/10 bg-surface p-3 ${canceled ? "opacity-60" : ""}`}
    >
      <span
        aria-hidden
        className="w-1 shrink-0 rounded-full bg-foreground/20"
        style={course.color ? { backgroundColor: course.color } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={`font-medium ${canceled ? "line-through" : ""}`}>
            {course.subject}
          </p>
          <p className="font-mono text-xs text-foreground/60">
            {formatTime(course.from, locale)} – {formatTime(course.to, locale)}
          </p>
        </div>
        <p className="mt-0.5 text-sm text-foreground/60">
          {[
            course.teacher,
            course.room && `${t.attendance.room} ${course.room}`,
            course.group,
            canceled ? t.attendance.canceledLesson : course.statusText,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </li>
  );
}

function Lessons({
  from,
  to,
  title,
  pick,
  children,
}: {
  from: string;
  to: string;
  title: string;
  pick: (courses: CourseDTO[]) => CourseDTO[];
  children?: ReactNode;
}) {
  const { t, locale } = useWebApp();
  const range = useMemo(() => {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [from, to]);
  const state = useApi<CourseDTO[]>("timetable", range);
  const multiDay =
    new Date(from).toDateString() !== new Date(to).toDateString();

  return (
    <div className="flex flex-col gap-3">
      {children}
      <p className="font-mono text-xs font-medium tracking-widest text-foreground/50 uppercase">
        {title}
      </p>
      <Async state={state}>
        {(courses) => {
          const lessons = pick(
            courses.filter((course) => course.kind === CourseKind.Lesson),
          ).sort((a, b) => a.from.localeCompare(b.from));
          if (!lessons.length)
            return (
              <p className="text-sm text-foreground/60">
                {t.attendance.noLessons}
              </p>
            );
          const days = new Map<string, CourseDTO[]>();
          for (const lesson of lessons) {
            const key = new Date(lesson.from).toDateString();
            days.set(key, [...(days.get(key) ?? []), lesson]);
          }
          return (
            <div className="flex flex-col gap-3">
              {[...days.values()].map((day) => (
                <div key={day[0].from} className="flex flex-col gap-2">
                  {multiDay && (
                    <p className="text-sm font-medium">
                      {capitalize(formatDay(day[0].from, locale))}
                    </p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {day.map((course) => (
                      <Lesson key={course.id} course={course} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        }}
      </Async>
    </div>
  );
}

function AbsenceDetail({ absence }: { absence: AbsenceDTO }) {
  const { t } = useWebApp();
  const start = new Date(absence.from).getTime();
  const end = new Date(absence.to).getTime();
  const notes = [
    absence.parentsMustJustify && !absence.justified
      ? t.attendance.parentsMustJustify
      : null,
    absence.regularized ? t.attendance.regularized : null,
  ].filter((note): note is string => Boolean(note));

  return (
    <Lessons
      from={absence.from}
      to={absence.to}
      title={t.attendance.missedLessons}
      pick={(courses) =>
        courses.filter(
          (course) =>
            new Date(course.from).getTime() < end &&
            new Date(course.to).getTime() > start,
        )
      }
    >
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notes.map((note) => (
            <span
              key={note}
              className="rounded-md bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/70"
            >
              {note}
            </span>
          ))}
        </div>
      )}
    </Lessons>
  );
}

function DelayDetail({ date }: { date: string }) {
  const { t } = useWebApp();
  const at = new Date(date).getTime();
  return (
    <Lessons
      from={date}
      to={date}
      title={t.attendance.lateLesson}
      pick={(courses) => {
        const during = courses.filter(
          (course) =>
            new Date(course.from).getTime() - delayWindow <= at &&
            at < new Date(course.to).getTime(),
        );
        const distance = (course: CourseDTO) =>
          Math.abs(new Date(course.from).getTime() - at);
        return during.sort((a, b) => distance(a) - distance(b)).slice(0, 1);
      }}
    />
  );
}

function AbsenceTotals({
  absences,
  units,
  status,
}: {
  absences: AbsenceDTO[];
  units: { hours: string; minutes: string };
  status: Status;
}) {
  const { t } = useWebApp();
  const justified = absences.filter((absence) => absence.justified);
  const unjustified = absences.filter((absence) => !absence.justified);
  const sum = (list: AbsenceDTO[]) =>
    list.reduce((total, absence) => total + absence.minutes, 0);
  const all = [
    { label: t.attendance.totalHours, list: absences, tone: "text-foreground" },
    {
      label: t.attendance.justifiedMany,
      list: justified,
      tone: "text-impact-up",
    },
    {
      label: t.attendance.unjustifiedMany,
      list: unjustified,
      tone: "text-impact-down",
    },
  ];
  const tiles =
    status === "all" ? all : status === "justified" ? [all[1]] : [all[2]];

  return (
    <div
      className={`mb-4 grid gap-2 sm:gap-4 ${tiles.length === 3 ? "grid-cols-3" : "grid-cols-1 sm:max-w-xs"}`}
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-foreground/10 bg-surface p-3 sm:p-5"
        >
          <p className="text-xs font-medium text-foreground/55 sm:text-sm">
            {tile.label}
          </p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums sm:text-3xl ${tile.tone}`}
          >
            {formatDuration(sum(tile.list), units)}
          </p>
          <p className="mt-0.5 text-xs text-foreground/45">
            {tile.list.length}{" "}
            {tile.list.length > 1
              ? t.attendance.absenceMany
              : t.attendance.absenceOne}
          </p>
        </div>
      ))}
    </div>
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
            {shows("absences") &&
              data.absences.some((absence) => matches(absence.justified)) && (
                <AbsenceTotals
                  absences={data.absences.filter((absence) =>
                    matches(absence.justified),
                  )}
                  units={units}
                  status={status}
                />
              )}
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
                      expand={() => <AbsenceDetail absence={absence} />}
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
                      title={`${capitalize(formatDay(delay.date, locale))} · ${delay.minutes} ${t.common.minutes}`}
                      detail={[
                        `${capitalize(t.attendance.at)} ${formatTime(delay.date, locale)}`,
                        delay.reason,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      tag={
                        delay.justified
                          ? t.common.justified
                          : t.common.notJustified
                      }
                      tone={delay.justified ? "good" : "bad"}
                      expand={() => <DelayDetail date={delay.date} />}
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
                          : t.attendance.remark
                      }
                      tone={observation.positive ? "good" : "bad"}
                      icon={<Face happy={observation.positive} />}
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
