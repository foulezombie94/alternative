"use client";

import {
  ArrowLeft,
  Calendar,
  Chair,
  Cutlery,
  Grades,
  Home,
  Logout,
  Newspaper,
  Tasks,
  TextBubble,
} from "@getpapillon/papicons";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useMemo } from "react";
import { Logo } from "@/components/ui/logo";
import type { Locale } from "@/i18n/config";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import type { Feature, ProfileDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { WebAppContext } from "./context";
import { ErrorBox, Loader } from "./ui";

type Icon = typeof Home;

const sections: { path: string; key: keyof WebAppDictionary["nav"]; icon: Icon; feature?: Feature }[] = [
  { path: "", key: "home", icon: Home },
  { path: "/timetable", key: "timetable", icon: Calendar, feature: "timetable" },
  { path: "/homework", key: "homework", icon: Tasks, feature: "homework" },
  { path: "/grades", key: "grades", icon: Grades, feature: "grades" },
  { path: "/attendance", key: "attendance", icon: Chair, feature: "attendance" },
  { path: "/news", key: "news", icon: Newspaper, feature: "news" },
  { path: "/messages", key: "messages", icon: TextBubble, feature: "chat" },
  { path: "/canteen", key: "canteen", icon: Cutlery, feature: "canteen" },
];

export function WebAppShell({ t, locale, children }: { t: WebAppDictionary; locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const profile = useApi<ProfileDTO>("profile");
  const base = `/${locale}/app`;

  const sessionLost = useCallback(() => window.location.replace(`${base}/login`), [base]);

  const logout = async () => {
    await call("logout").catch(() => undefined);
    sessionLost();
  };

  const visible = useMemo(
    () => sections.filter((section) => !section.feature || profile.data?.features.includes(section.feature)),
    [profile.data],
  );

  if (!profile.data) {
    return (
      <WebAppContext
        value={{
          t,
          locale,
          sessionLost,
          profile: { name: "", firstName: "", school: "", demo: false, features: [] },
        }}
      >
        <main className="flex min-h-dvh items-center justify-center px-6">
          {profile.error ? <ErrorBox error={profile.error} retry={profile.reload} /> : <Loader />}
        </main>
      </WebAppContext>
    );
  }

  const user = profile.data;
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <WebAppContext value={{ t, locale, profile: user, sessionLost }}>
      <div className="min-h-dvh lg:flex">
        <aside className="sticky top-0 z-30 flex flex-col gap-1 border-foreground/5 bg-background lg:h-dvh lg:w-72 lg:shrink-0 lg:border-r lg:p-5">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:mb-4 lg:px-2 lg:py-0">
            <Link href={base as Route} className="text-primary" aria-label={t.nav.home}>
              <Logo aria-hidden className="h-6" />
            </Link>
            {user.demo && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {t.nav.demoBadge}
              </span>
            )}
          </div>

          <nav
            aria-label={t.nav.label}
            className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:p-0"
          >
            {visible.map(({ path, key, icon: SectionIcon }) => {
              const href = `${base}${path}`;
              const active = path ? pathname.startsWith(href) : pathname === href;
              return (
                <Link
                  key={key}
                  href={href as Route}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2.5 font-medium transition-colors ${
                    active ? "bg-primary text-white" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <SectionIcon className="size-5" />
                  {t.nav[key]}
                </Link>
              );
            })}
          </nav>

          <div className="hidden flex-col gap-1 lg:flex">
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-sm text-foreground/50">
                  {[user.className, user.school].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href={`/${locale}` as Route}
              className="flex items-center gap-3 rounded-2xl px-4 py-2.5 font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
            >
              <ArrowLeft className="size-5" />
              {t.nav.backToSite}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-3 rounded-2xl px-4 py-2.5 text-left font-medium text-feature-schedule transition-colors hover:bg-feature-schedule/10"
            >
              <Logout className="size-5" />
              {t.nav.logout}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 pt-4 pb-16 lg:px-10 lg:pt-10">
          <div className="mx-auto max-w-6xl">{children}</div>
          <button
            type="button"
            onClick={logout}
            className="mx-auto mt-10 flex items-center gap-2 rounded-full px-4 py-2 font-medium text-feature-schedule lg:hidden"
          >
            <Logout className="size-5" />
            {t.nav.logout}
          </button>
        </main>
      </div>
    </WebAppContext>
  );
}
