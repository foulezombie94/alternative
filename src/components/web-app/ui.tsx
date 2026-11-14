"use client";

import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Paper } from "@getpapillon/papicons";
import DOMPurify from "dompurify";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { type AttachmentDTO, CourseState, type PeriodDTO } from "@/lib/pronote/types";
import { type ApiFailure, sessionLostCodes } from "./api";
import { useWebApp } from "./context";
import { addDays, formatDuration, formatShortDate, startOfWeek } from "./format";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-foreground/10 bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-mono text-xs font-medium tracking-widest text-foreground/50 uppercase">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loader() {
  const { t } = useWebApp();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-foreground/50" role="status">
      <Spinner className="size-5" />
      {t.common.loading}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-foreground/50">{children}</p>;
}

export function ErrorBox({ error, retry }: { error: ApiFailure; retry?: () => void }) {
  const { t, sessionLost } = useWebApp();
  const lost = sessionLostCodes.includes(error.code);

  useEffect(() => {
    if (lost) sessionLost();
  }, [lost, sessionLost]);

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="size-7 text-feature-schedule" />
      <p className="max-w-md text-foreground/70">{t.errors[error.code] ?? t.errors.unknown}</p>
      {error.message && error.message !== error.code && (
        <p className="max-w-md text-sm text-foreground/40">
          {t.errors.detail} : {error.message}
        </p>
      )}
      {retry && !lost && (
        <button
          type="button"
          onClick={retry}
          className="rounded-md bg-foreground/5 px-4 py-2 font-medium transition-colors hover:bg-foreground/10"
        >
          {t.errors.retry}
        </button>
      )}
    </div>
  );
}

export function Async<T>({
  state,
  empty,
  isEmpty,
  children,
}: {
  state: { data?: T; error?: ApiFailure; loading: boolean; reload: () => void };
  empty?: string;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (state.error) return <ErrorBox error={state.error} retry={state.reload} />;
  if (state.loading || state.data === undefined) return <Loader />;
  if (empty && isEmpty?.(state.data)) return <Empty>{empty}</Empty>;
  return children(state.data);
}

const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function linkify(html: string) {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest("a") && urlPattern.test(node.data)) texts.push(node);
    urlPattern.lastIndex = 0;
  }

  for (const node of texts) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of node.data.matchAll(urlPattern)) {
      const url = match[0].replace(/[.,;:!?)\]]+$/, "");
      const start = match.index ?? 0;
      fragment.append(node.data.slice(cursor, start));
      const link = document.createElement("a");
      link.href = url.startsWith("www.") ? `https://${url}` : url;
      link.textContent = url;
      fragment.append(link);
      cursor = start + url.length;
    }
    fragment.append(node.data.slice(cursor));
    node.replaceWith(fragment);
  }

  for (const link of template.content.querySelectorAll("a[href]")) {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }
  return template.innerHTML;
}

export function Html({ html, className = "" }: { html: string; className?: string }) {
  const clean = useMemo(
    () => linkify(DOMPurify.sanitize(html, { ADD_ATTR: ["target"], FORBID_TAGS: ["style", "form", "input"] })),
    [html],
  );
  return (
    <div
      className={`max-w-none wrap-anywhere [&_a]:font-medium [&_a]:text-feature-news [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function Attachments({ files }: { files: AttachmentDTO[] }) {
  const { t } = useWebApp();
  if (!files.length) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-foreground/50">{t.common.attachments}</p>
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => (
          <li key={file.url}>
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              <Paper className="size-4 text-primary" />
              {file.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeekPicker({ week, onChange }: { week: Date; onChange: (week: Date) => void }) {
  const { t, locale } = useWebApp();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(week.getFullYear(), week.getMonth(), 1));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = new Date();
  const first = startOfWeek(month);
  const weeks = Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, column) => addDays(first, row * 7 + column))).filter(
    (days, row) => row < 5 || days[0].getMonth() === month.getMonth(),
  );
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const arrow = "flex size-8 items-center justify-center rounded-md transition-colors hover:bg-foreground/5";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t.common.pickDate}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t.common.pickDate}
        onClick={() => {
          setMonth(new Date(week.getFullYear(), week.getMonth(), 1));
          setOpen((value) => !value);
        }}
        className={`flex size-10 items-center justify-center rounded-full border transition-colors ${
          open ? "border-primary bg-primary text-white" : "border-foreground/10 bg-surface hover:bg-foreground/10"
        }`}
      >
        <Calendar className="size-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.common.pickDate}
          className="absolute top-full right-0 z-40 mt-2 w-72 rounded-xl border border-foreground/10 bg-surface p-3 shadow-xl sm:right-auto sm:left-0"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t.common.previousMonth}
              className={arrow}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-medium first-letter:uppercase">
              {month.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              aria-label={t.common.nextMonth}
              className={arrow}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 pb-1 text-center font-mono text-xs tracking-widest text-foreground/40 uppercase">
            {weeks[0].map((day) => (
              <span key={day.getDay()}>{day.toLocaleDateString(locale, { weekday: "narrow" })}</span>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            {weeks.map((days) => {
              const selected = same(days[0], week);
              return (
                <div key={days[0].toISOString()} className={`grid grid-cols-7 rounded-md ${selected ? "bg-primary text-white" : ""}`}>
                  {days.map((day) => {
                    const outside = day.getMonth() !== month.getMonth();
                    const isToday = same(day, today);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        aria-label={day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        aria-current={isToday ? "date" : undefined}
                        onClick={() => {
                          onChange(startOfWeek(day));
                          setOpen(false);
                        }}
                        className={`flex h-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                          selected ? "hover:bg-white/15" : "hover:bg-foreground/5"
                        } ${outside ? "opacity-35" : ""} ${isToday ? "font-semibold" : ""}`}
                      >
                        <span className={isToday ? "flex size-7 items-center justify-center rounded-full bg-accent text-white" : ""}>
                          {day.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(startOfWeek(new Date()));
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md border border-foreground/10 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            {t.common.thisWeek}
          </button>
        </div>
      )}
    </div>
  );
}

export function WeekNav({
  week,
  onChange,
  calendar = false,
}: {
  week: Date;
  onChange: (week: Date) => void;
  calendar?: boolean;
}) {
  const { t, locale } = useWebApp();
  const current = startOfWeek(new Date()).getTime() === week.getTime();
  const button = "flex size-10 items-center justify-center rounded-full border border-foreground/10 bg-surface transition-colors hover:bg-foreground/10";

  return (
    <div className="flex items-center gap-2">
      {calendar && <WeekPicker week={week} onChange={onChange} />}
      <button type="button" aria-label={t.common.previousWeek} className={button} onClick={() => onChange(addDays(week, -7))}>
        <ChevronLeft className="size-5" />
      </button>
      <span className="min-w-36 text-center font-medium">
        {current ? t.common.thisWeek : `${t.common.weekOf} ${formatShortDate(week, locale)}`}
      </span>
      <button type="button" aria-label={t.common.nextWeek} className={button} onClick={() => onChange(addDays(week, 7))}>
        <ChevronRight className="size-5" />
      </button>
      {!current && (
        <button
          type="button"
          className="rounded-md border border-foreground/10 bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
          onClick={() => onChange(startOfWeek(new Date()))}
        >
          {t.common.thisWeek}
        </button>
      )}
    </div>
  );
}

export function PeriodSelect({
  periods,
  value,
  onChange,
}: {
  periods: PeriodDTO[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t } = useWebApp();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t.common.period}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer rounded-md border border-foreground/10 bg-surface px-4 py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SubjectDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-3 shrink-0 rounded-full bg-primary"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useWebApp();

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="max-h-dvh w-full max-w-xl overflow-y-auto rounded-xl bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/10 bg-surface px-3 py-1 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            {t.common.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useNow(interval = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

export function isLive(course: { from: string; to: string; state?: CourseState }, now: Date) {
  return course.state !== CourseState.Canceled && new Date(course.from) <= now && now < new Date(course.to);
}

export function LiveProgress({ from, to, now }: { from: string; to: string; now: Date }) {
  const { t } = useWebApp();
  const reduceMotion = useReducedMotion();
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const progress = Math.min(100, Math.max(0, ((now.getTime() - start) / (end - start)) * 100));
  const left = Math.max(1, Math.ceil((end - now.getTime()) / 60000));

  return (
    <span className="mt-2 block">
      <span className="flex flex-wrap items-center justify-between gap-x-2 text-xs font-semibold whitespace-nowrap text-accent">
        <span className="flex items-center gap-1.5">
          <motion.span
            aria-hidden
            className="size-2 rounded-full bg-accent"
            animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          {t.timetable.now}
        </span>
        <span className="tabular-nums">
          {t.timetable.endsIn} {formatDuration(left, { hours: t.common.hours, minutes: t.common.minutes })}
        </span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-accent/15">
        <span className="block h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </span>
    </span>
  );
}

export function Wordmark({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-mono font-medium tracking-tight text-foreground lowercase ${className}`}>
      <span aria-hidden className="size-2.5 rounded-xs bg-accent" />
      {name}
    </span>
  );
}
