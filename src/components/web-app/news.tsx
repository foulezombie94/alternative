"use client";

import { Check, ChevronLeft, Newspaper, Paper, Pie, Search } from "@getpapillon/papicons";
import { useMemo, useState } from "react";
import type { NewsDetailDTO, NewsDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, formatShortDate } from "./format";
import { Async, Attachments, Empty, Html, PageHeader } from "./ui";

type FilterId = "all" | "unread" | "confirm" | "survey";

const filters: Record<FilterId, (item: NewsDTO) => boolean> = {
  all: () => true,
  unread: (item) => !item.read,
  confirm: (item) => item.needsAcknowledgement && !item.acknowledged,
  survey: (item) => item.survey,
};

function plain(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function Tag({ children, strong = false }: { children: string; strong?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        strong ? "bg-accent/10 text-accent" : "bg-foreground/5 text-foreground/60"
      }`}
    >
      {children}
    </span>
  );
}

function Tags({ item }: { item: NewsDTO }) {
  const { t } = useWebApp();
  const pending = item.needsAcknowledgement && !item.acknowledged;
  if (!item.survey && !pending && !item.category) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {item.survey && <Tag>{t.news.survey}</Tag>}
      {pending && <Tag strong>{t.news.toConfirm}</Tag>}
      {item.category && <Tag>{item.category}</Tag>}
    </span>
  );
}

function Row({ item, active, onSelect }: { item: NewsDTO; active: boolean; onSelect: () => void }) {
  const { t, locale } = useWebApp();
  const Icon = item.survey ? Pie : Newspaper;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={`flex w-full items-start gap-3 rounded-lg border bg-surface p-3 text-left transition-colors ${
        active ? "border-foreground" : "border-foreground/10 hover:border-foreground/30"
      }`}
    >
      <span
        className={`relative grid size-10 shrink-0 place-items-center rounded-md ${
          item.read ? "bg-foreground/5 text-foreground/50" : "bg-foreground text-background"
        }`}
      >
        <Icon className="size-5" />
        {!item.read && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-surface bg-accent" aria-label={t.news.unread} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`line-clamp-2 ${item.read ? "font-medium" : "font-semibold"}`}>{item.title}</span>
          <span className="shrink-0 font-mono text-xs text-foreground/50">{formatShortDate(item.date, locale)}</span>
        </span>
        {item.author && <span className="truncate text-sm text-foreground/50">{item.author}</span>}
        <span className="flex items-center justify-between gap-2">
          <Tags item={item} />
          {item.attachments.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-foreground/50">
              <Paper className="size-4" />
              {item.attachments.length}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

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
      className="mt-6 rounded-md bg-primary px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [debug, setDebug] = useState<{ id: string; data: Debug } | null>(null);
  const month = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);

  async function loadDebug(id: string) {
    setDebug({ id, data: await call<Debug>("newsDebug", { id }) });
  }

  const labels: Record<FilterId, string> = {
    all: t.news.all,
    unread: t.news.unreadFilter,
    confirm: t.news.toConfirm,
    survey: t.news.surveys,
  };

  return (
    <>
      <PageHeader title={t.nav.news} />
      <Async state={state} empty={t.common.empty} isEmpty={(list) => !list.length}>
        {(list) => {
          const words = plain(search).split(/\s+/).filter(Boolean);
          const visible = list.filter((item) => {
            if (!filters[filter](item)) return false;
            const text = plain([item.title, item.author, item.category, item.content].join(" "));
            return words.every((word) => text.includes(word));
          });
          const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
          const tabs = (Object.keys(filters) as FilterId[])
            .map((id) => ({ id, count: list.filter(filters[id]).length }))
            .filter((tab) => tab.id === "all" || tab.count > 0);
          const groups = new Map<string, NewsDTO[]>();
          for (const item of visible) {
            const key = capitalize(month.format(new Date(item.date)));
            groups.set(key, [...(groups.get(key) ?? []), item]);
          }
          const markAcknowledged = (id: string) =>
            state.update(list.map((entry) => (entry.id === id ? { ...entry, acknowledged: true, read: true } : entry)));

          return (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
              <div className={`flex flex-col gap-4 lg:col-span-2 ${opened ? "max-lg:hidden" : ""}`}>
                <label className="relative">
                  <span className="sr-only">{t.news.search}</span>
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.news.search}
                    className="w-full rounded-md border border-foreground/10 bg-surface py-2 pr-4 pl-9 outline-none transition-colors placeholder:text-foreground/40 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
                {tabs.length > 1 && (
                  <div role="group" aria-label={t.news.filters} className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={filter === tab.id}
                        onClick={() => setFilter(tab.id)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                          filter === tab.id
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/10 bg-surface text-foreground/70 hover:border-foreground/30"
                        }`}
                      >
                        {labels[tab.id]}
                        <span className="font-mono text-xs opacity-60">{tab.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {visible.length === 0 && <Empty>{t.news.noMatch}</Empty>}
                {[...groups].map(([title, items]) => (
                  <section key={title} className="flex flex-col gap-2">
                    <h2 className="font-mono text-xs tracking-wide text-foreground/50 uppercase">{title}</h2>
                    <ul className="flex flex-col gap-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <Row
                            item={item}
                            active={item.id === selected?.id}
                            onSelect={() => {
                              setSelectedId(item.id);
                              setOpened(true);
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <article
                className={`rounded-xl border border-foreground/10 bg-surface p-5 sm:p-8 lg:sticky lg:top-6 lg:col-span-3 ${
                  opened ? "" : "max-lg:hidden"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpened(false)}
                  className="mb-5 flex items-center gap-1 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground lg:hidden"
                >
                  <ChevronLeft className="size-4" />
                  {t.news.back}
                </button>
                {selected ? (
                  <>
                    <Tags item={selected} />
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance">{selected.title}</h2>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-foreground/50">
                      {selected.author && <span className="font-medium text-foreground/80">{selected.author}</span>}
                      <span>{capitalize(formatDay(selected.date, locale, true))}</span>
                    </p>
                    <div className="mt-6 border-t border-foreground/10 pt-6">
                      <Body key={selected.id} item={selected} onAcknowledged={() => markAcknowledged(selected.id)} />
                    </div>
                    <div className="mt-8 text-xs">
                      {debug?.id === selected.id ? (
                        <>
                          <p className="mb-2 text-foreground/60">
                            {t.news.diagnosticHint} (patch: {String(debug.data.patched)})
                          </p>
                          <pre className="max-h-96 overflow-auto rounded-md bg-background p-3 whitespace-pre-wrap select-all">
                            {debug.data.raw ?? "null"}
                          </pre>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => loadDebug(selected.id)}
                          className="text-foreground/30 underline transition-colors hover:text-foreground"
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
