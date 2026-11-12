"use client";

import { Check } from "@getpapillon/papicons";
import { useState } from "react";
import type { NewsDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatShortDate } from "./format";
import { Async, Attachments, Empty, Html, PageHeader } from "./ui";

export function WebAppNews() {
  const { t, locale } = useWebApp();
  const state = useApi<NewsDTO[]>("news");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function acknowledge(item: NewsDTO, list: NewsDTO[]) {
    setSaving(true);
    try {
      await call("acknowledgeNews", { id: item.id });
      state.update(list.map((entry) => (entry.id === item.id ? { ...entry, acknowledged: true, read: true } : entry)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title={t.nav.news} />
      <Async state={state} empty={t.common.empty} isEmpty={(list) => !list.length}>
        {(list) => {
          const selected = list.find((item) => item.id === selectedId) ?? list[0];
          return (
            <div className="grid gap-4 lg:grid-cols-5">
              <ul className="flex flex-col gap-2 lg:col-span-2">
                {list.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-2xl p-4 text-left transition-colors ${
                        item.id === selected?.id ? "bg-primary/10" : "bg-surface hover:bg-foreground/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {!item.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={t.news.unread} />}
                        <span className="truncate font-semibold">{item.title}</span>
                      </span>
                      <span className="block truncate text-sm text-foreground/50">
                        {[item.category, formatShortDate(item.date, locale)].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <article className="rounded-3xl bg-surface p-6 lg:col-span-3">
                {selected ? (
                  <>
                    {selected.category && <p className="mb-1 text-sm font-medium text-primary">{selected.category}</p>}
                    <h2 className="mb-1 text-2xl font-semibold">{selected.title}</h2>
                    <p className="mb-5 text-sm text-foreground/50">
                      {capitalize(formatDay(selected.date, locale, true))} · {t.news.by} {selected.author}
                    </p>
                    <Html html={selected.content} className="text-foreground/80" />
                    <Attachments files={selected.attachments} />
                    {selected.needsAcknowledgement &&
                      (selected.acknowledged ? (
                        <p className="mt-6 flex items-center gap-2 font-medium text-primary">
                          <Check className="size-5" />
                          {t.news.acknowledged}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => acknowledge(selected, list)}
                          className="mt-6 rounded-full bg-primary px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {t.news.acknowledge}
                        </button>
                      ))}
                  </>
                ) : (
                  <Empty>{t.news.select}</Empty>
                )}
              </article>
            </div>
          );
        }}
      </Async>
    </>
  );
}
