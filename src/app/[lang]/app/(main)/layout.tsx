import type { Metadata } from "next";
import { WebAppShell } from "@/components/web-app/shell";
import { getDictionary, getLocale } from "@/i18n/server";
import { appMetadata } from "@/lib/app-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return appMetadata(dict.webApp, locale, "");
}

export default async function WebAppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <WebAppShell t={dict.webApp} locale={locale}>
      {children}
    </WebAppShell>
  );
}
