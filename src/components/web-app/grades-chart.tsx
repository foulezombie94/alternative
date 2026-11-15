"use client";

import { ChevronDown } from "@getpapillon/papicons";
import { motion, useReducedMotion } from "motion/react";
import { type PointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { GradeDTO, SubjectDTO } from "@/lib/pronote/types";
import { subjectAverage } from "@/lib/pronote/average";
import { easeOutPapillon } from "@/lib/motion";
import { useWebApp } from "./context";
import { formatScore, formatShortDate } from "./format";
import { GradeScore, on20, SubjectDot } from "./ui";

type Point = { value: number; date: Date; subject?: SubjectDTO; grade?: GradeDTO; final?: boolean };

const graphHeight = 168;
const verticalPadding = 28;
const horizontalPadding = 20;

function history(subjects: SubjectDTO[]): Point[] {
  const dated = subjects
    .flatMap((subject) => subject.grades.filter((grade) => grade.date).map((grade) => ({ subject, grade })))
    .sort((a, b) => new Date(a.grade.date!).getTime() - new Date(b.grade.date!).getTime());

  const seen = new Map<string, GradeDTO[]>();
  const points: Point[] = [];
  for (const { subject, grade } of dated) {
    seen.set(subject.id, [...(seen.get(subject.id) ?? []), grade]);
    const averages = [...seen.values()].map((grades) => subjectAverage(grades)).filter((value) => value !== null);
    if (!averages.length) continue;
    const value = averages.reduce((sum, average) => sum + average, 0) / averages.length;
    points.push({ value, date: new Date(grade.date!), subject, grade });
  }
  return points;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  const slopes = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / (next.x - point.x || 1);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[index - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before * after <= 0) return 0;
    return (2 * before * after) / (before + after);
  });
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    const third = (to.x - from.x) / 3;
    path += ` C${from.x + third},${from.y + tangents[index] * third} ${to.x - third},${to.y - tangents[index + 1] * third} ${to.x},${to.y}`;
  }
  return path;
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

export function GradesChart({
  subjects,
  overall,
  officialOverall,
}: {
  subjects: SubjectDTO[];
  overall: number | null;
  officialOverall: boolean;
}) {
  const { t, locale } = useWebApp();
  const reduceMotion = useReducedMotion();
  const gradientId = useId();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [frame, width] = useWidth();

  const choices = subjects.filter((subject) => subject.grades.some((grade) => grade.date));
  const subject = subjects.find((entry) => entry.id === subjectId) ?? null;

  const points = useMemo(() => {
    const list = history(subject ? [subject] : subjects);
    const target = subject ? subject.average.value : overall;
    const last = list.at(-1);
    if (last && target !== null) {
      if (Math.abs(last.value - target) > 0.005) list.push({ value: target, date: new Date(), final: true });
      else last.final = true;
    }
    return list;
  }, [subjects, subject, overall]);

  const color = subject?.color;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, 1);
  const base = low - (range - (high - low)) / 2;
  const step = points.length > 1 ? (width - horizontalPadding * 2) / (points.length - 1) : 0;
  const coordinates = points.map((point, index) => ({
    x: horizontalPadding + index * step,
    y: verticalPadding + (1 - (point.value - base) / range) * (graphHeight - verticalPadding * 2),
  }));
  const path = smoothPath(coordinates);
  const area = path ? `${path} L${coordinates.at(-1)!.x},${graphHeight} L${coordinates[0].x},${graphHeight} Z` : "";

  const index = hover ?? points.length - 1;
  const shown = points[index];
  const spot = coordinates[index];

  function track(event: PointerEvent<SVGSVGElement>) {
    if (!step) return;
    const box = event.currentTarget.getBoundingClientRect();
    const position = Math.round((event.clientX - box.left - horizontalPadding) / step);
    setHover(Math.min(points.length - 1, Math.max(0, position)));
  }

  const caption = !shown
    ? ""
    : shown.final && !subject && officialOverall
      ? t.grades.bySchool
      : shown.final
        ? t.grades.current
        : `${t.grades.estimatedOn} ${shown.date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-foreground/10 bg-surface"
      style={color ? { backgroundColor: `color-mix(in oklab, ${color} 7%, var(--color-surface))` } : undefined}
    >
      {points.length >= 2 ? (
        <div ref={frame} className={color ? "" : "text-primary"} style={color ? { color } : undefined}>
          {width > 0 && (
            <svg
              width={width}
              height={graphHeight}
              role="img"
              aria-label={`${subject ? subject.name : t.grades.overall} : ${formatScore({ value: points.at(-1)!.value }, locale)}/20`}
              className="block touch-pan-y"
              onPointerMove={track}
              onPointerDown={track}
              onPointerLeave={() => setHover(null)}
              onPointerCancel={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#${gradientId})`} />
              <motion.path
                key={`${subjectId}-${points.length}-${width}`}
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: easeOutPapillon }}
              />
              {hover !== null && spot && (
                <line
                  x1={spot.x}
                  x2={spot.x}
                  y1={0}
                  y2={graphHeight}
                  stroke="currentColor"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                />
              )}
              {spot && (
                <g>
                  {hover === null && !reduceMotion && (
                    <motion.circle
                      cx={spot.x}
                      cy={spot.y}
                      fill="currentColor"
                      initial={{ r: 6, opacity: 0.35 }}
                      animate={{ r: 16, opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <circle cx={spot.x} cy={spot.y} r={6} fill="currentColor" className="stroke-surface" strokeWidth={3} />
                </g>
              )}
            </svg>
          )}
        </div>
      ) : (
        <p className="px-5 pt-6 pb-2 text-sm text-foreground/50">{t.grades.notEnough}</p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-1 pb-5">
        <div className="min-w-0">
          <p className={`flex items-baseline gap-0.5 tabular-nums ${color ? "" : "text-primary"}`} style={color ? { color } : undefined}>
            <span className="text-4xl font-semibold tracking-tight">
              {shown ? shown.value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "–"}
            </span>
            <span className="text-lg font-medium opacity-70">/20</span>
          </p>
          <label className="relative mt-1 inline-flex max-w-full cursor-pointer items-center gap-2">
            <span className="sr-only">{t.grades.evolutionSubject}</span>
            {subject && <SubjectDot color={subject.color} />}
            <select
              value={subjectId ?? ""}
              onChange={(event) => {
                setSubjectId(event.target.value || null);
                setHover(null);
              }}
              className="max-w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-lg font-semibold outline-none [field-sizing:content] focus-visible:underline"
            >
              <option value="">{t.grades.overall}</option>
              {choices.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-0 size-4 opacity-50" />
          </label>
          <p className="text-sm text-foreground/55">{caption}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-1 text-sm sm:items-end">
          {hover !== null && shown?.grade && shown.subject ? (
            <p className="flex min-w-0 items-center gap-2">
              <SubjectDot color={shown.subject.color} />
              <span className="truncate text-foreground/70">{shown.grade.description || shown.subject.name}</span>
              <GradeScore value={shown.grade.value} outOf={shown.grade.outOf} />
            </p>
          ) : subject && subject.classAverage.value !== null ? (
            <p className="text-foreground/60">
              {t.grades.class}{" "}
              <span className="font-semibold text-foreground tabular-nums">{formatScore(subject.classAverage, locale)}</span>
            </p>
          ) : (
            <p className="text-foreground/45">{t.grades.evolutionHint}</p>
          )}
          {points.length >= 2 && (
            <button
              type="button"
              aria-expanded={showTable}
              onClick={() => setShowTable((value) => !value)}
              className="self-start text-xs font-medium text-foreground/50 underline-offset-4 transition-colors hover:text-foreground hover:underline sm:self-end"
            >
              {showTable ? t.grades.hideTable : t.grades.showTable}
            </button>
          )}
        </div>
      </div>

      {showTable && (
        <div className="mx-5 mb-5 max-h-72 overflow-auto rounded-lg border border-foreground/10 bg-surface">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-foreground/50">
              <tr>
                <th className="px-3 py-2 font-medium">{t.grades.date}</th>
                <th className="px-3 py-2 font-medium">{t.grades.newGrades}</th>
                <th className="px-3 py-2 text-right font-medium">{t.grades.average}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, position) => (
                <tr key={position} className="border-t border-foreground/5">
                  <td className="px-3 py-2 whitespace-nowrap text-foreground/60">{formatShortDate(point.date, locale)}</td>
                  <td className="px-3 py-2">
                    {point.grade && point.subject
                      ? `${point.subject.name} ${formatScore(point.grade.value, locale)}/${formatScore(point.grade.outOf, locale)}${
                          on20(point.grade.value, point.grade.outOf) !== null
                            ? ` (${formatScore({ value: on20(point.grade.value, point.grade.outOf) }, locale)}/20)`
                            : ""
                        }`
                      : !subject && officialOverall
                        ? t.grades.bySchool
                        : t.grades.current}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatScore({ value: point.value }, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
