"use client";

import { Check } from "@getpapillon/papicons";
import { useState } from "react";
import type { NewsDetailDTO, NewsDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatShortDate } from "./format";
import { Async, Attachments, Empty, Html, PageHeader } from "./ui";

type Debug = { patched: boolean; raw: string | null };

function Acknowledge({ item, onDone }: { item: NewsDTO; onDone: () => void }) {
  const { t } = useWebApp();
  const [saving, setSaving] = useState(false);

  if (item.acknowledged) {
    return (
      <p className="mt-6 flex items-center gap-2 font-medium text-primary">
        <Check className="size-5" />
        {t.news.acknowledged}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        try {
          await call("acknowledgeNews", { id: item.id });
          onDone();
        } finally {
          setSaving(false);
        }
      }}
      className="mt-6 rounded-full bg-primary px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {t.news.acknowledge}
    </button>
  );
}

function Body({ item, onAcknowledged }: { item: NewsDTO; onAcknowledged: () => void }) {
  const { t } = useWebApp();
  const needsDetail = !item.content.trim();
  const detail = useApi<NewsDetailDTO | null>(needsDetail ? "newsDetail" : null, {
    id: item.id,
    title: item.title,
    date: item.date,
  });
  const [acknowledged, setAcknowledged] = useState(false);

  if (!needsDetail) {
    return (
      <>
        <Html html={item.content} className="text-foreground/80" />
        <Attachments files={item.attachments} />
        {item.needsAcknowledgement && <Acknowledge item={item} onDone={onAcknowledged} />}
      </>
    );
  }

  return (
    <Async state={detail}>
      {(data) => {
        const content = data?.content ?? "";
        const merged = {
          ...item,
          acknowledged: acknowledged || item.acknowledged || Boolean(data?.acknowledged),
        };
        return (
          <>
            {content.trim() ? (
              <Html html={content} className="text-foreground/80" />
            ) : (
              <p className="text-sm text-foreground/60">{t.news.emptyContent}</p>
            )}
            <Attachments files={[...item.attachments, ...(data?.attachments ?? [])]} />
            {(item.needsAcknowledgement || data?.needsAcknowledgement) && (
              <Acknowledge
                item={merged}
                onDone={() => {
                  setAcknowledged(true);
                  onAcknowledged();
                }}
              />
            )}
          </>
        );
      }}
    </Async>
  );
}

export function WebAppNews() {
  const { t, locale } = useWebApp();
  const state = useApi<NewsDTO[]>("news");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [debug, setDebug] = useState<{ id: string; data: Debug } | null>(null);

  async function loadDebug(id: string) {
    setDebug({ id, data: await call<Debug>("newsDebug", { id }) });
  }

  return (
    <>
      <PageHeader title={t.nav.news} />
      <Async state={state} empty={t.common.empty} isEmpty={(list) => !list.length}>
        {(list) => {
          const selected = list.find((item) => item.id === selectedId) ?? list[0];
          const markAcknowledged = (id: string) =>
            state.update(list.map((entry) => (entry.id === id ? { ...entry, acknowledged: true, read: true } : entry)));

          return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
                      {capitalize(formatDay(selected.date, locale, true))}
                      {selected.author && ` · ${t.news.by} ${selected.author}`}
                    </p>
                    <Body key={selected.id} item={selected} onAcknowledged={() => markAcknowledged(selected.id)} />
                    <div className="mt-8 border-t border-foreground/5 pt-4 text-sm">
                      {debug?.id === selected.id ? (
                        <>
                          <p className="mb-2 text-foreground/60">
                            {t.news.diagnosticHint} (patch: {String(debug.data.patched)})
                          </p>
                          <pre className="max-h-96 overflow-auto rounded-xl bg-background p-3 text-xs whitespace-pre-wrap select-all">
                            {debug.data.raw ?? "null"}
                          </pre>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => loadDebug(selected.id)}
                          className="text-foreground/40 underline transition-colors hover:text-foreground"
                        >
                          {t.news.diagnostic}
                        </button>
                      )}
                    </div>
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
