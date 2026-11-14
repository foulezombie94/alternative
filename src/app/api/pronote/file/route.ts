import type { NextRequest } from "next/server";
import { userAgent } from "@/lib/pronote/fetcher";
import { openSession, sessionCookie } from "@/lib/pronote/store";

const sizeLimit = 4 * 1024 * 1024;

const textSandbox = "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src *";

const types: Record<string, { type: string; text?: boolean }> = {
  pdf: { type: "application/pdf" },
  png: { type: "image/png" },
  jpg: { type: "image/jpeg" },
  jpeg: { type: "image/jpeg" },
  gif: { type: "image/gif" },
  webp: { type: "image/webp" },
  html: { type: "text/html", text: true },
  htm: { type: "text/html", text: true },
  txt: { type: "text/plain", text: true },
  md: { type: "text/plain", text: true },
  csv: { type: "text/plain", text: true },
  css: { type: "text/plain", text: true },
  js: { type: "text/plain", text: true },
  json: { type: "text/plain", text: true },
  py: { type: "text/plain", text: true },
  c: { type: "text/plain", text: true },
  java: { type: "text/plain", text: true },
};

function decode(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export async function GET(request: NextRequest) {
  const session = openSession(request.cookies.get(sessionCookie)?.value);
  if (!session || session.kind !== "pronote") return new Response(null, { status: 401 });

  let target: URL;
  try {
    target = new URL(request.nextUrl.searchParams.get("u") ?? "");
  } catch {
    return new Response(null, { status: 400 });
  }

  const school = new URL(session.credentials.refresh.url);
  if (
    !["https:", "http:"].includes(target.protocol) ||
    target.host !== school.host ||
    !target.pathname.includes("/FichiersExternes/")
  ) {
    return new Response(null, { status: 403 });
  }

  const extension = decodeURIComponent(target.pathname).split(".").pop()?.toLowerCase() ?? "";
  const format = types[extension];
  if (!format) return new Response(null, { status: 415 });

  let response: Response;
  try {
    response = await fetch(target, {
      headers: { "User-Agent": userAgent },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!response.ok) return new Response(null, { status: 502 });
  if (Number(response.headers.get("content-length")) > sizeLimit) return new Response(null, { status: 413 });

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > sizeLimit) return new Response(null, { status: 413 });

  const headers = new Headers({
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=600",
    "Referrer-Policy": "no-referrer",
  });

  if (format.text) {
    headers.set("Content-Type", `${format.type}; charset=utf-8`);
    headers.set("Content-Security-Policy", textSandbox);
    return new Response(decode(buffer), { headers });
  }

  headers.set("Content-Type", format.type);
  if (format.type.startsWith("image/")) headers.set("Content-Security-Policy", "default-src 'none'");
  return new Response(buffer, { headers });
}
