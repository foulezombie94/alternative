import type { Metadata } from "next";
import { WebAppShell } from "@/components/web-app/shell";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.webApp.metadataTitle, description: dict.webApp.metadataDescription, robots: { index: false } };
}

export default async function WebAppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <WebAppShell t={dict.webApp} locale={locale}>
      {children}
    </WebAppShell>
  );
}
