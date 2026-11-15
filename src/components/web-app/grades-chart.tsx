"use client";

import { type PointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { GradeDTO, SubjectDTO } from "@/lib/pronote/types";
import { subjectAverage } from "@/lib/pronote/average";
import { useWebApp } from "./context";
import { dayKey, formatScore, formatShortDate } from "./format";
import { Panel, SubjectDot } from "./ui";

type Added = { subject: SubjectDTO; grade: GradeDTO };
type Point = { date: Date; value: number; added: Added[] };

const height = 240;
const padding = { top: 16, right: 56, bottom: 28, left: 32 };

function scale(values: number[]) {
  let low = Math.max(0, Math.floor(Math.min(...values) - 1));
  let high = Math.min(20, Math.ceil(Math.max(...values) + 1));
  while (high - low < 4) {
    if (low > 0) low -= 1;
    if (high - low < 4 && high < 20) high += 1;
  }
  const step = high - low <= 6 ? 1 : high - low <= 12 ? 2 : 5;
  low = Math.floor(low / step) * step;
  high = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = low; tick <= high; tick += step) ticks.push(tick);
  return { low, high, ticks };
}

function evolution(subjects: SubjectDTO[], subjectId: string | null): Point[] {
  const scope = subjectId ? subjects.filter((subject) => subject.id === subjectId) : subjects;
  const dated = scope
    .flatMap((subject) => subject.grades.filter((grade) => grade.date).map((grade) => ({ subject, grade })))
    .sort((a, b) => new Date(a.grade.date!).getTime() - new Date(b.grade.date!).getTime());

  const days = new Map<string, { date: Date; added: Added[] }>();
  for (const entry of dated) {
    const date = new Date(entry.grade.date!);
    const key = dayKey(date);
    const day = days.get(key) ?? { date, added: [] };
    day.added.push(entry);
    days.set(key, day);
  }

  const seen = new Map<string, GradeDTO[]>();
  const points: Point[] = [];
  for (const { date, added } of days.values()) {
    for (const { subject, grade } of added) seen.set(subject.id, [...(seen.get(subject.id) ?? []), grade]);
    const averages = [...seen.values()].map((grades) => subjectAverage(grades)).filter((value) => value !== null);
    if (!averages.length) continue;
    points.push({ date, value: averages.reduce((sum, value) => sum + value, 0) / averages.length, added });
  }
  return points;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function GradesChart({ subjects }: { subjects: SubjectDTO[] }) {
  const { t, locale } = useWebApp();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [frame, width] = useWidth();
  const titleId = useId();

  const choices = subjects.filter((subject) => subject.grades.some((grade) => grade.date));
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;
  const points = useMemo(() => evolution(subjects, subject?.id ?? null), [subjects, subject]);
  const reference = subject?.classAverage.value ?? null;

  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const first = points[0]?.date.getTime() ?? 0;
  const span = Math.max(1, (points.at(-1)?.date.getTime() ?? 0) - first);
  const x = (point: Point) =>
    padding.left + (points.length === 1 ? plotWidth / 2 : ((point.date.getTime() - first) / span) * plotWidth);
  const domain = points.length
    ? scale([...points.map((point) => point.value), ...(reference !== null ? [reference] : [])])
    : { low: 0, high: 20, ticks: [0, 5, 10, 15, 20] };
  const y = (value: number) =>
    padding.top + plotHeight - ((Math.min(domain.high, Math.max(domain.low, value)) - domain.low) / (domain.high - domain.low)) * plotHeight;
  const ticks = domain.ticks;

  const line = points.map((point, index) => `${index ? "L" : "M"}${x(point)},${y(point.value)}`).join(" ");
  const last = points.at(-1);
  const active = hover !== null ? points[hover] : null;
  const change = last && points.length > 1 ? last.value - points[0].value : null;

  function track(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - box.left + padding.left;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(x(point) - position) < Math.abs(x(points[nearest]) - position)) nearest = index;
    });
    setHover(nearest);
  }

  const score = (value: number) => formatScore({ value }, locale);

  return (
    <Panel
      title={t.grades.evolution}
      className="mb-6"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={titleId} className="flex items-center gap-2 font-semibold">
            {subject && <SubjectDot color={subject.color} />}
            {subject ? subject.name : t.grades.overall}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/60 tabular-nums">
            {change !== null && (
              <span>
                {change >= 0 ? "▲" : "▼"} {change >= 0 ? "+" : "−"}
                {score(Math.abs(change))} {t.grades.sinceStart}
              </span>
            )}
            {reference !== null && (
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-px w-4 bg-foreground/40" />
                {t.grades.class} {score(reference)}
              </span>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 max-sm:w-full">
          <span className="sr-only">{t.grades.evolutionSubject}</span>
          <select
            value={subjectId ?? ""}
            onChange={(event) => {
              setSubjectId(event.target.value || null);
              setHover(null);
            }}
            className="w-full cursor-pointer sm:w-auto sm:max-w-64 truncate rounded-md border border-foreground/10 bg-surface px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">{t.grades.overall}</option>
            {choices.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {points.length < 2 ? (
        <p className="py-10 text-center text-sm text-foreground/50">{t.grades.notEnough}</p>
      ) : (
        <div ref={frame} className="relative">
          {width > 0 && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-labelledby={titleId}
              className="block overflow-visible"
              onPointerLeave={(event) => event.pointerType === "mouse" && setHover(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    x2={padding.left + plotWidth}
                    y1={y(tick)}
                    y2={y(tick)}
                    className="stroke-foreground/10"
                    strokeWidth={1}
                  />
                  <text
                    x={padding.left - 8}
                    y={y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-foreground/45 text-xs tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {reference !== null && (
                <g>
                  <line
                    x1={padding.left}
                    x2={padding.left + plotWidth}
                    y1={y(reference)}
                    y2={y(reference)}
                    className="stroke-foreground/35"
                    strokeWidth={1}
                  />
                </g>
              )}

              <path
                d={line}
                fill="none"
                className="stroke-primary"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              <text
                x={padding.left}
                y={height - 6}
                className="fill-foreground/45 text-xs"
              >
                {formatShortDate(points[0].date, locale)}
              </text>
              <text
                x={padding.left + plotWidth}
                y={height - 6}
                textAnchor="end"
                className="fill-foreground/45 text-xs"
              >
                {formatShortDate(last!.date, locale)}
              </text>

              {points.length <= (width < 480 ? 10 : 24) &&
                points.slice(0, -1).map((point) => (
                  <circle
                    key={point.date.toISOString()}
                    cx={x(point)}
                    cy={y(point.value)}
                    r={4}
                    className="fill-primary stroke-surface"
                    strokeWidth={2}
                  />
                ))}

              {last && (
                <g>
                  <circle cx={x(last)} cy={y(last.value)} r={5} className="fill-primary stroke-surface" strokeWidth={2} />
                  <text
                    x={x(last) + 10}
                    y={y(last.value)}
                    dy="0.32em"
                    className="fill-foreground text-sm font-semibold tabular-nums"
                  >
                    {score(last.value)}
                  </text>
                </g>
              )}

              {active && (
                <g pointerEvents="none">
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={padding.top}
                    y2={padding.top + plotHeight}
                    className="stroke-foreground/30"
                    strokeWidth={1}
                  />
                  <circle cx={x(active)} cy={y(active.value)} r={5} className="fill-primary stroke-surface" strokeWidth={2} />
                </g>
              )}

              <rect
                x={padding.left - 8}
                y={padding.top}
                width={plotWidth + 16}
                height={plotHeight}
                fill="transparent"
                onPointerMove={track}
                onPointerDown={track}
              />
            </svg>
          )}

          {active && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 w-60 rounded-lg border border-foreground/10 bg-surface p-3 text-sm shadow-lg"
              style={{
                left: Math.min(Math.max(0, x(active) - 120), Math.max(0, width - 240)),
                top: y(active.value),
                transform: y(active.value) > height / 2 ? "translateY(calc(-100% - 0.75rem))" : "translateY(0.75rem)",
              }}
            >
              <p className="text-xs text-foreground/50">{formatShortDate(active.date, locale)}</p>
              <p className="mb-2 font-semibold tabular-nums">
                {t.grades.average} {score(active.value)}
                <span className="font-normal text-foreground/40">/20</span>
              </p>
              <ul className="flex flex-col gap-1">
                {active.added.slice(0, 4).map(({ subject: owner, grade }) => (
                  <li key={grade.id} className="flex items-center gap-2">
                    <SubjectDot color={owner.color} />
                    <span className="min-w-0 flex-1 truncate text-foreground/70">
                      {subject ? grade.description || owner.name : owner.name}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatScore(grade.value, locale)}
                      <span className="text-foreground/40">/{formatScore(grade.outOf, locale)}</span>
                    </span>
                  </li>
                ))}
                {active.added.length > 4 && (
                  <li className="text-xs text-foreground/50">+{active.added.length - 4}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {points.length >= 2 && (
        <div className="mt-3 flex flex-col items-start gap-1">
          <p className="text-xs text-foreground/45">{t.grades.evolutionHint}</p>
          <button
            type="button"
            aria-expanded={showTable}
            onClick={() => setShowTable((value) => !value)}
            className="text-sm font-medium text-foreground/60 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {showTable ? t.grades.hideTable : t.grades.showTable}
          </button>
          {showTable && (
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-foreground/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-foreground/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t.grades.date}</th>
                    <th className="px-3 py-2 font-medium">{t.grades.newGrades}</th>
                    <th className="px-3 py-2 text-right font-medium">{t.grades.average}</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.date.toISOString()} className="border-t border-foreground/5">
                      <td className="px-3 py-2 whitespace-nowrap text-foreground/60">{formatShortDate(point.date, locale)}</td>
                      <td className="px-3 py-2">
                        {point.added
                          .map(({ subject: owner, grade }) => `${owner.name} ${formatScore(grade.value, locale)}/${formatScore(grade.outOf, locale)}`)
                          .join(", ")}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{score(point.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
