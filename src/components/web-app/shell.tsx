"use client";

import { Archive, ArrowLeft, Bookmark, Calendar, Chair, Cross, Grades, Home, Logout, Menu, Newspaper, Paper, Star, Tasks, TextBubble } from "@getpapillon/papicons";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import { NotificationBell, useNotifications } from "./notifications";
import { easeOutPapillon } from "@/lib/motion";
import type { AccountDTO, Feature, ProfileDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { showcaseEnabled } from "@/lib/showcase";
import { useWebApp, WebAppContext } from "./context";
import { Async, Dialog, ErrorBox, Loader, Wordmark } from "./ui";

type Icon = typeof Home;

type NavKey = keyof WebAppDictionary["nav"];

const sections: { path: string; key: NavKey; icon: Icon; feature?: Feature; group?: NavKey }[] = [
  { path: "", key: "home", icon: Home },
  { path: "/contents", key: "contents", icon: Paper, feature: "contents", group: "groupTextbook" },
  { path: "/homework", key: "homework", icon: Tasks, feature: "homework", group: "groupTextbook" },
  { path: "/grades", key: "grades", icon: Grades, feature: "grades", group: "groupGrades" },
  { path: "/report", key: "report", icon: Bookmark, feature: "report", group: "groupGrades" },
  { path: "/documents", key: "documents", icon: Archive, feature: "documents", group: "groupGrades" },
  { path: "/evaluations", key: "evaluations", icon: Star, feature: "evaluations", group: "groupSkills" },
  { path: "/timetable", key: "timetable", icon: Calendar, feature: "timetable", group: "groupSchoolLife" },
  { path: "/attendance", key: "attendance", icon: Chair, feature: "attendance", group: "groupSchoolLife" },
  { path: "/news", key: "news", icon: Newspaper, feature: "news", group: "groupCommunication" },
  { path: "/messages", key: "messages", icon: TextBubble, feature: "chat", group: "groupCommunication" },
];

export function WebAppShell({ t, locale, children }: { t: WebAppDictionary; locale: Locale; children: ReactNode }) {
  const pathname = usePathname();
  const profile = useApi<ProfileDTO>("profile");
  const [accountOpen, setAccountOpen] = useState(false);
  const base = `/${locale}/app`;

  const sessionLost = useCallback(() => window.location.replace(`${base}/login`), [base]);
  const notifications = useNotifications(profile.data?.name ?? "", base, t, locale);

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

  const links = visible.map(({ path, key, icon: SectionIcon, group }) => {
    const href = `${base}${path}`;
    const active = path ? pathname.startsWith(href) : pathname === href;
    return { href, key, SectionIcon, active, group };
  });
  const current = links.find((link) => link.active);

  const navList = (large: boolean) =>
    links.map(({ href, key, SectionIcon, active, group }, index) => (
      <Fragment key={key}>
        {group && group !== links[index - 1]?.group && (
          <p className="mt-3 px-4 pb-1 font-mono text-xs font-medium tracking-widest text-foreground/40 uppercase">
            {t.nav[group]}
          </p>
        )}
        <Link
          href={href as Route}
          aria-current={active ? "page" : undefined}
          className={`flex shrink-0 items-center gap-3 rounded-lg px-4 font-medium transition-colors ${large ? "py-3 text-lg" : "py-2"} ${
            active ? "bg-primary text-white" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          <SectionIcon className={large ? "size-6" : "size-5"} />
          {t.nav[key]}
        </Link>
      </Fragment>
    ));

  const account = (
    <>
      <button
        type="button"
        aria-label={t.account.open}
        aria-haspopup="dialog"
        onClick={() => setAccountOpen(true)}
        className="mb-2 flex items-center gap-3 rounded-lg border border-foreground/10 bg-surface p-3 text-left transition-colors hover:border-foreground/30"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-white">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{user.name}</span>
          <span className="block truncate text-sm text-foreground/50">
            {[user.className, user.school].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
      {showcaseEnabled && (
        <Link
          href={`/${locale}` as Route}
          className="flex items-center gap-3 rounded-lg px-4 py-2.5 font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          <ArrowLeft className="size-5" />
          {t.nav.backToSite}
        </Link>
      )}
      <button
        type="button"
        onClick={logout}
        className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-left font-medium text-feature-schedule transition-colors hover:bg-feature-schedule/10"
      >
        <Logout className="size-5" />
        {t.nav.logout}
      </button>
    </>
  );

  const demoBadge = user.demo && (
    <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-primary">{t.nav.demoBadge}</span>
  );

  return (
    <WebAppContext value={{ t, locale, profile: user, sessionLost }}>
      <div className="min-h-dvh lg:flex">
        <aside className="sticky top-0 z-40 hidden h-dvh w-72 shrink-0 flex-col gap-1 border-r border-foreground/5 bg-background p-5 lg:flex">
          <div className="mb-4 flex items-center justify-between gap-2 pl-2">
            <span className="flex items-center gap-0.5">
              <Link href={base as Route} aria-label={t.nav.home}>
                <Wordmark name={t.brand} className="text-lg" />
              </Link>
              <NotificationBell state={notifications} t={t} locale={locale} />
            </span>
            {demoBadge}
          </div>
          <nav aria-label={t.nav.label} className="scrollbar-none flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {navList(false)}
          </nav>
          <div className="flex flex-col gap-1">{account}</div>
        </aside>

        <MobileBar
          t={t}
          title={current ? t.nav[current.key] : ""}
          home={base}
          badge={demoBadge}
          pathname={pathname}
          nav={navList(true)}
          account={account}
          bell={<NotificationBell state={notifications} t={t} locale={locale} align="right" />}
        />

        {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}

        <main className="min-w-0 flex-1 px-5 pt-4 pb-16 lg:px-10 lg:pt-10">
          <div className={["/timetable", "/homework", "/contents", "/evaluations"].some((path) => pathname.endsWith(path)) ? "w-full" : "mx-auto max-w-6xl"}>{children}</div>
        </main>
      </div>
    </WebAppContext>
  );
}

function AccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useWebApp();
  const state = useApi<AccountDTO>("account");

  return (
    <Dialog title={t.account.title} onClose={onClose}>
      <Async state={state}>
        {(data) => {
          const rows = [
            [t.account.class, data.className],
            [t.account.school, data.school],
            [t.account.email, data.email],
            [t.account.phone, data.phone],
            [t.account.address, data.address],
            [t.account.ine, data.ine],
          ].filter((row): row is [string, string] => Boolean(row[1]));

          return (
            <>
              <p className="text-xl font-semibold">{data.name}</p>
              {data.delegate && (
                <p className="mt-2 inline-block rounded-md bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {t.account.delegate}
                </p>
              )}
              <dl className="mt-5 flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-3">
                    <dt className="w-32 shrink-0 font-mono text-xs tracking-widest text-foreground/50 uppercase">{label}</dt>
                    <dd className="min-w-0 font-medium wrap-anywhere whitespace-pre-line">{value}</dd>
                  </div>
                ))}
              </dl>
              {!data.detailsAvailable && <p className="mt-4 text-sm text-foreground/50">{t.account.unavailable}</p>}
            </>
          );
        }}
      </Async>
    </Dialog>
  );
}

function MobileBar({
  t,
  title,
  home,
  badge,
  pathname,
  nav,
  account,
  bell,
}: {
  t: WebAppDictionary;
  bell: ReactNode;
  title: string;
  home: string;
  badge: ReactNode;
  pathname: string;
  nav: ReactNode;
  account: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const reduceMotion = useReducedMotion();
  const visible = open && openedOn === pathname;

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.documentElement.classList.add("overflow-hidden");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [visible]);

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.35, ease: easeOutPapillon };

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-foreground/5 bg-background/90 px-3 py-2 backdrop-blur">
        <button
          type="button"
          aria-label={t.nav.openMenu}
          aria-expanded={visible}
          aria-controls="web-app-menu"
          onClick={() => {
            setOpenedOn(pathname);
            setOpen(true);
          }}
          className="flex size-11 items-center justify-center rounded-full transition hover:bg-foreground/5 active:scale-95"
        >
          <Menu aria-hidden className="size-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</p>
        {badge}
        {bell}
      </header>

      <AnimatePresence>
        {visible && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40 bg-foreground/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={() => setOpen(false)}
          />
        )}
        {visible && (
          <motion.div
            key="panel"
            id="web-app-menu"
            role="dialog"
            aria-modal
            aria-label={t.nav.label}
            className="fixed inset-y-0 left-0 z-50 flex w-5/6 max-w-sm flex-col gap-1 overflow-y-auto overscroll-contain bg-background p-4 shadow-2xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={transition}
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setOpen(false);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3 pl-2">
              <Link href={home as Route} aria-label={t.nav.home}>
                <Wordmark name={t.brand} className="text-lg" />
              </Link>
              <button
                type="button"
                aria-label={t.nav.closeMenu}
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-full transition hover:bg-foreground/5 active:scale-95"
              >
                <Cross aria-hidden className="size-6" />
              </button>
            </div>
            <nav aria-label={t.nav.label} className="flex flex-col gap-1">
              {nav}
            </nav>
            <div className="mt-auto flex flex-col gap-1 pt-6">{account}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
