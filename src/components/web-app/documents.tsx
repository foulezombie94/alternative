"use client";

import { Paper } from "@getpapillon/papicons";
import { useState } from "react";
import type { DocumentsDTO, ReportFileDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { Async, PageHeader } from "./ui";

type Year = { label: string; year: number; className: string; periods: { name: string; start: string; files: ReportFileDTO[] }[] };

function group(reports: ReportFileDTO[]): Year[] {
  const years = new Map<string, Year>();
  for (const report of reports) {
    const label = report.yearLabel || String(report.year);
    const year = years.get(label) ?? { label, year: report.year, className: report.className, periods: [] };
    let period = year.periods.find((entry) => entry.name === report.period);
    if (!period) {
      period = { name: report.period, start: report.periodStart ?? "", files: [] };
      year.periods.push(period);
    }
    period.files.push(report);
    years.set(label, year);
  }
  return [...years.values()]
    .sort((a, b) => b.year - a.year || b.label.localeCompare(a.label))
    .map((year) => ({
      ...year,
      periods: year.periods
        .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
        .map((period) => ({ ...period, files: period.files.sort((a, b) => b.kind.localeCompare(a.kind)) })),
    }));
}

function FileButton({ file, onError }: { file: ReportFileDTO; onError: (message: string) => void }) {
  const { t } = useWebApp();
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    onError("");
    const tab = window.open("", "_blank");
    try {
      const { url } = await call<{ url: string }>("documentPdf", { key: file.key });
      if (!url) {
        tab?.close();
        onError(t.documents.demo);
        return;
      }
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch {
      tab?.close();
      onError(t.documents.failed);
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="group flex min-w-0 items-center gap-3 rounded-lg border border-foreground/10 bg-background p-3 text-left transition-colors hover:border-foreground/30 disabled:opacity-60"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground/5 text-foreground/70 transition-colors group-hover:bg-foreground group-hover:text-background">
        <Paper className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.kind}</span>
        <span className="block text-xs text-foreground/50">{opening ? t.documents.opening : t.documents.pdf}</span>
      </span>
    </button>
  );
}

export function WebAppDocuments() {
  const { t } = useWebApp();
  const state = useApi<DocumentsDTO>("documents");
  const [error, setError] = useState("");

  return (
    <>
      <PageHeader title={t.nav.documents} />
      {error && <p className="mb-4 rounded-lg bg-impact-down/10 px-4 py-3 text-sm text-impact-down">{error}</p>}
      <Async state={state} empty={t.documents.none} isEmpty={(data) => !data.reports.length}>
        {(data) => (
          <div className="flex flex-col gap-6">
            {group(data.reports).map((year) => (
              <section key={year.label} className="rounded-xl border border-foreground/10 bg-surface p-4 sm:p-6">
                <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {t.documents.year} {year.label.replace("-", " – ")}
                  </h2>
                  {year.className && (
                    <span className="rounded-full bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/70">{year.className}</span>
                  )}
                </header>
                <div className="grid gap-4 md:grid-cols-3">
                  {year.periods.map((period) => (
                    <div key={period.name} className="flex flex-col gap-2">
                      <p className="font-mono text-xs tracking-widest text-foreground/45 uppercase">{period.name}</p>
                      {period.files.map((file) => (
                        <FileButton key={file.key} file={file} onError={setError} />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="text-center text-sm text-foreground/45">{t.documents.hint}</p>
          </div>
        )}
      </Async>
    </>
  );
}
