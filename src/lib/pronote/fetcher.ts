import type { createSessionHandle } from "@blockshub/pawnote-lts";

type Fetcher = NonNullable<Parameters<typeof createSessionHandle>[0]>;

const requestTimeout = 60 * 1000;

const userAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 PRONOTE Mobile APP Version/2.0.11";

export const pronoteFetcher: Fetcher = async (options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeout);

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: { ...options.headers, "User-Agent": userAgent },
      body: options.method !== "GET" ? options.content : undefined,
      redirect: options.redirect,
      signal: controller.signal,
    });

    const content = await response.text();

    return {
      content,
      status: response.status,
      get headers() {
        return response.headers;
      },
    };
  } finally {
    clearTimeout(timeout);
  }
};
