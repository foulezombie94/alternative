import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import { siteUrl } from "@/lib/seo";

const ogLocales: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

export function appUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return host ? `https://${host}` : siteUrl;
}

export function appMetadata(t: WebAppDictionary, locale: Locale, path: string): Metadata {
  const url = `/${locale}/app${path}`;
  const image = { url: `/${locale}/app/opengraph-image`, width: 1200, height: 630, alt: t.brand };
  return {
    metadataBase: new URL(appUrl()),
    title: t.metadataTitle,
    description: t.metadataDescription,
    applicationName: t.brand,
    robots: { index: false },
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: t.brand,
      locale: ogLocales[locale],
      url,
      title: t.metadataTitle,
      description: t.metadataDescription,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: t.metadataTitle,
      description: t.metadataDescription,
      images: [image],
    },
    itunes: null,
    appleWebApp: { title: t.brand },
  };
}
