import type { Metadata } from "next";
import { WebAppLogin } from "@/components/web-app/login";
import { getDictionary, getLocale } from "@/i18n/server";
import { appMetadata } from "@/lib/app-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return appMetadata(dict.webApp, locale, "/login");
}

export default async function WebAppLoginPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <WebAppLogin t={dict.webApp} locale={locale} />;
}
