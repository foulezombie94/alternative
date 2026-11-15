"use client";

import { Bell, Calendar, Grades, Newspaper, TextBubble } from "@getpapillon/papicons";
import type { Route } from "next";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Score } from "@/lib/pronote/types";
import { easeOutPapillon } from "@/lib/motion";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import { ApiFailure, call } from "./api";
import { formatScore, formatShortDate, formatTime } from "./format";

type Feed = {
  grades: { id: string; subject: string; color?: string; description: string; value: Score; outOf: Score; date?: string }[];
  news: { id: string; title: string; author: string; date: string; read: boolean }[];
  chats: { id: string; subject: string; with: string; date: string; unread: number }[];
  canceled: { id: string; subject: string; color?: string; from: string; to: string; statusText?: string }[];
};

type Kind = "grade" | "news" | "chat" | "canceled";

type Item = {
  key: string;
  kind: Kind;
  title: string;
  detail: string;
  date: number;
  href: string;
  color?: string;
  fresh: boolean;
};

type Memory = { since: number; seen: string[] };

const icons = { grade: Grades, news: Newspaper, chat: TextBubble, canceled: Calendar };
const refreshEvery = 10 * 60 * 1000;
const firstLookBack = 7 * 24 * 60 * 60 * 1000;
const keepEarlier = 14 * 24 * 60 * 60 * 1000;

function storageKey(owner: string) {
  return `alternative.notifications.${owner}`;
}

function readMemory(owner: string): Memory {
  try {
    const raw = window.localStorage.getItem(storageKey(owner));
    if (raw) {
      const parsed = JSON.parse(raw) as Memory;
      if (typeof parsed.since === "number" && Array.isArray(parsed.seen)) return parsed;
    }
  } catch {}
  return { since: Date.now() - firstLookBack, seen: [] };
}

function writeMemory(owner: string, memory: Memory) {
  try {
    window.localStorage.setItem(storageKey(owner), JSON.stringify({ ...memory, seen: memory.seen.slice(-500) }));
  } catch {}
}

export function useNotifications(owner: string, base: string, t: WebAppDictionary, locale: string) {
  const [feed, setFeed] = useState<(Feed & { fetchedAt: number }) | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);
  const lastFetch = useRef(0);

  const load = useCallback(() => {
    lastFetch.current = Date.now();
    call<Feed>("notifications")
      .then((data) => setFeed({ ...data, fetchedAt: Date.now() }))
      .catch((error: unknown) => {
        if (!(error instanceof ApiFailure)) return;
      });
  }, []);

  useEffect(() => {
    if (!owner) return;
    const restore = window.setTimeout(() => setMemory(readMemory(owner)), 0);
    const first = window.setTimeout(load, 1500);
    const timer = window.setInterval(load, refreshEvery);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > refreshEvery / 2) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(restore);
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [owner, load]);

  const items = useMemo<Item[]>(() => {
    if (!feed || !memory) return [];
    const seen = new Set(memory.seen);
    const list: Item[] = [];

    for (const grade of feed.grades) {
      if (!grade.date) continue;
      const date = new Date(grade.date).getTime();
      const key = `grade:${grade.id}`;
      const score = `${formatScore(grade.value, locale)}/${formatScore(grade.outOf, locale)}`;
      list.push({
        key,
        kind: "grade",
        title: `${t.notifications.newGrade} · ${grade.subject}`,
        detail: [score, grade.description].filter(Boolean).join(" · "),
        date,
        href: `${base}/grades`,
        color: grade.color,
        fresh: date >= memory.since && !seen.has(key),
      });
    }

    for (const entry of feed.news) {
      const key = `news:${entry.id}`;
      list.push({
        key,
        kind: "news",
        title: entry.title,
        detail: [t.notifications.newNews, entry.author].filter(Boolean).join(" · "),
        date: new Date(entry.date).getTime(),
        href: `${base}/news`,
        fresh: !entry.read && !seen.has(key),
      });
    }

    for (const chat of feed.chats) {
      const key = `chat:${chat.id}:${Math.floor(new Date(chat.date).getTime() / 60000)}`;
      list.push({
        key,
        kind: "chat",
        title: chat.subject || chat.with,
        detail:
          chat.unread > 0
            ? `${chat.unread} ${chat.unread > 1 ? t.notifications.unreadMessages : t.notifications.unreadMessage} · ${chat.with}`
            : chat.with,
        date: new Date(chat.date).getTime(),
        href: `${base}/messages`,
        fresh: chat.unread > 0 && !seen.has(key),
      });
    }

    for (const course of feed.canceled) {
      const key = `canceled:${course.id}`;
      list.push({
        key,
        kind: "canceled",
        title: `${t.notifications.canceled} · ${course.subject}`,
        detail: `${formatShortDate(course.from, locale)} · ${formatTime(course.from, locale)} – ${formatTime(course.to, locale)}`,
        date: new Date(course.from).getTime(),
        href: `${base}/timetable`,
        color: course.color,
        fresh: !seen.has(key),
      });
    }

    const now = feed.fetchedAt;
    return list
      .filter((item) => item.fresh || (item.kind === "canceled" ? true : now - item.date < keepEarlier))
      .sort((a, b) => {
        if (a.fresh !== b.fresh) return Number(b.fresh) - Number(a.fresh);
        const aCanceled = a.kind === "canceled";
        const bCanceled = b.kind === "canceled";
        if (aCanceled !== bCanceled) return Number(bCanceled) - Number(aCanceled);
        return aCanceled ? a.date - b.date : b.date - a.date;
      });
  }, [feed, memory, base, t, locale]);

  const fresh = items.filter((item) => item.fresh);

  const markSeen = useCallback(
    (keys: string[]) => {
      setMemory((current) => {
        const next = { since: current?.since ?? Date.now(), seen: [...new Set([...(current?.seen ?? []), ...keys])] };
        writeMemory(owner, next);
        return next;
      });
    },
    [owner],
  );

  return { items, freshCount: fresh.length, markSeen, loaded: feed !== null };
}

export type NotificationsState = ReturnType<typeof useNotifications>;

export function NotificationBell({
  state,
  t,
  locale,
  align = "left",
}: {
  state: NotificationsState;
  t: WebAppDictionary;
  locale: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { items, freshCount, markSeen, loaded } = state;
  const freshItems = items.filter((item) => item.fresh);
  const earlier = items.filter((item) => !item.fresh).slice(0, 12);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row = (item: Item) => {
    const Icon = icons[item.kind];
    return (
      <li key={item.key}>
        <Link
          href={item.href as Route}
          onClick={() => {
            markSeen([item.key]);
            setOpen(false);
          }}
          className={`flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-foreground/5 ${item.fresh ? "" : "opacity-70"}`}
        >
          <span
            className={`relative grid size-9 shrink-0 place-items-center rounded-md ${
              item.kind === "canceled" ? "bg-impact-down/15 text-impact-down" : "bg-foreground/5 text-foreground/70"
            }`}
          >
            <Icon className="size-4.5" />
            {item.color && item.kind !== "canceled" && (
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface"
                style={{ backgroundColor: item.color }}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`line-clamp-2 text-sm leading-snug ${item.fresh ? "font-semibold" : "font-medium"}`}>{item.title}</span>
            <span className="mt-0.5 block truncate text-xs text-foreground/55">{item.detail}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs text-foreground/45 tabular-nums">{formatShortDate(new Date(item.date), locale)}</span>
            {item.fresh && <span aria-label={t.notifications.fresh} className="size-2 rounded-full bg-accent" />}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={freshCount ? `${t.notifications.open} (${freshCount})` : t.notifications.open}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-10 items-center justify-center rounded-full transition hover:bg-foreground/5 active:scale-95"
      >
        <Bell aria-hidden className="size-5.5" />
        {freshCount > 0 && (
          <span className="absolute top-0.5 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-xs leading-none font-semibold text-white tabular-nums">
            {freshCount > 9 ? "9+" : freshCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t.notifications.title}
            initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={{ duration: 0.2, ease: easeOutPapillon }}
            className={`z-50 flex max-h-128 w-96 flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-surface shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:top-16 max-sm:w-auto sm:absolute sm:top-full sm:mt-2 ${
              align === "right" ? "sm:right-0" : "sm:left-0"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
              <p className="font-semibold">{t.notifications.title}</p>
              {freshCount > 0 && (
                <button
                  type="button"
                  onClick={() => markSeen(freshItems.map((item) => item.key))}
                  className="text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
                >
                  {t.notifications.markAll}
                </button>
              )}
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
              {!loaded ? (
                <p className="px-3 py-8 text-center text-sm text-foreground/50">{t.notifications.loading}</p>
              ) : !items.length ? (
                <p className="px-3 py-8 text-center text-sm text-foreground/50">{t.notifications.empty}</p>
              ) : (
                <>
                  {freshItems.length > 0 && <ul className="flex flex-col">{freshItems.map(row)}</ul>}
                  {freshItems.length === 0 && (
                    <p className="px-3 pt-4 pb-2 text-center text-sm text-foreground/50">{t.notifications.empty}</p>
                  )}
                  {earlier.length > 0 && (
                    <>
                      <p className="px-3 pt-3 pb-1 font-mono text-xs tracking-widest text-foreground/40 uppercase">
                        {t.notifications.earlier}
                      </p>
                      <ul className="flex flex-col">{earlier.map(row)}</ul>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
