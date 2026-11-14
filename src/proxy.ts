import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, hasLocale, localeCookie } from "@/i18n/config";
import { sessionCookie } from "@/lib/pronote/store";
import { showcaseEnabled } from "@/lib/showcase";

function appEntry(request: NextRequest, locale: string) {
  const url = request.nextUrl.clone();
  url.pathname = request.cookies.has(sessionCookie) ? `/${locale}/app` : `/${locale}/app/login`;
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.endsWith(".md")) return NextResponse.rewrite(new URL(`/md${pathname}`, request.url));

  const pathLocale = pathname.split("/")[1];

  if (hasLocale(pathLocale)) {
    if (!showcaseEnabled && pathname.split("/")[2] !== "app") return appEntry(request, pathLocale);
    const response = NextResponse.next();
    if (request.cookies.get(localeCookie)?.value !== pathLocale) {
      response.cookies.set(localeCookie, pathLocale, { maxAge: 60 * 60 * 24 * 365 });
    }
    return response;
  }

  if (!showcaseEnabled) return appEntry(request, preferredLocale(request));

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(localeCookie)?.value;
  if (hasLocale(saved)) return saved;

  const accepted = request.headers
    .get("accept-language")
    ?.split(",")
    .map((entry) => entry.split(";")[0].trim().slice(0, 2).toLowerCase());

  return accepted?.find(hasLocale) ?? defaultLocale;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)", "/(.*\\.md)"],
};
