import type { Metadata } from "next";
import { WebAppLogin } from "@/components/web-app/login";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.webApp.metadataTitle, description: dict.webApp.metadataDescription, robots: { index: false } };
}

export default async function WebAppLoginPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <WebAppLogin t={dict.webApp} locale={locale} />;
}
