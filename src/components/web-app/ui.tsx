"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Paper } from "@getpapillon/papicons";
import DOMPurify from "dompurify";
import { type ReactNode, useEffect, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { AttachmentDTO, PeriodDTO } from "@/lib/pronote/types";
import { type ApiFailure, sessionLostCodes } from "./api";
import { useWebApp } from "./context";
import { addDays, formatShortDate, startOfWeek } from "./format";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
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
    <section className={`rounded-3xl bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
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
      {retry && !lost && (
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-foreground/5 px-4 py-2 font-medium transition-colors hover:bg-foreground/10"
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

export function Html({ html, className = "" }: { html: string; className?: string }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html, { ADD_ATTR: ["target"], FORBID_TAGS: ["style", "form", "input"] }),
    [html],
  );
  return (
    <div
      className={`max-w-none break-words [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc ${className}`}
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
              className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
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

export function WeekNav({ week, onChange }: { week: Date; onChange: (week: Date) => void }) {
  const { t, locale } = useWebApp();
  const current = startOfWeek(new Date()).getTime() === week.getTime();
  const button = "flex size-10 items-center justify-center rounded-full bg-surface transition-colors hover:bg-foreground/10";

  return (
    <div className="flex items-center gap-2">
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
          className="rounded-full bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/10"
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
        className="cursor-pointer rounded-full bg-surface px-4 py-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        className="max-h-dvh w-full max-w-xl overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-surface px-3 py-1 text-sm font-medium transition-colors hover:bg-foreground/10"
          >
            {t.common.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
