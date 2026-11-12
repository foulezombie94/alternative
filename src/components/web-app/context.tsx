"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/i18n/config";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import type { ProfileDTO } from "@/lib/pronote/types";

export type WebAppContextValue = {
  t: WebAppDictionary;
  locale: Locale;
  profile: ProfileDTO;
  sessionLost: () => void;
};

export const WebAppContext = createContext<WebAppContextValue | null>(null);

export function useWebApp() {
  const value = useContext(WebAppContext);
  if (!value) throw new Error("useWebApp must be used inside the web app shell");
  return value;
}
