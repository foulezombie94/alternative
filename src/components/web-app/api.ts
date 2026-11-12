"use client";

import { useCallback, useEffect, useState } from "react";
import type { ErrorCode } from "@/lib/pronote/types";

export class ApiFailure extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const sessionLostCodes: ErrorCode[] = ["not_logged_in", "session_expired"];

let queue: Promise<unknown> = Promise.resolve();

export function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const next = queue.then(() => send<T>(action, params));
  queue = next.catch(() => undefined);
  return next;
}

async function send<T>(action: string, params: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/pronote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });
  } catch {
    throw new ApiFailure("unreachable", "network");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiFailure((data.code as ErrorCode) ?? "unknown", data.error ?? response.statusText);
  }
  return data as T;
}

type State<T> = { key: string; data?: T; error?: ApiFailure };

export function useApi<T>(action: string | null, params: Record<string, unknown> = {}) {
  const key = action ? `${action}:${JSON.stringify(params)}` : "";
  const [state, setState] = useState<State<T>>({ key: "" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!action) return;
    let active = true;
    call<T>(action, JSON.parse(key.slice(action.length + 1)))
      .then((data) => active && setState({ key, data }))
      .catch((error: unknown) =>
        active &&
        setState({
          key,
          error: error instanceof ApiFailure ? error : new ApiFailure("unknown", String(error)),
        }),
      );
    return () => {
      active = false;
    };
  }, [action, key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const update = useCallback((data: T) => setState({ key, data }), [key]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: Boolean(action) && !current,
    reload,
    update,
  };
}

type Loadable<T> = { data?: T; error?: ApiFailure; loading: boolean; reload: () => void };

export function after<A, B>(first: Loadable<A>, second: Loadable<B>, fallback?: B): Loadable<B> {
  if (first.error) return { error: first.error, loading: false, reload: first.reload };
  if (first.data !== undefined && fallback !== undefined && !second.loading && second.data === undefined && !second.error) {
    return { data: fallback, loading: false, reload: first.reload };
  }
  return second;
}
