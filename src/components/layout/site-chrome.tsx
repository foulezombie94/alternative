"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (/^\/[a-z]{2}\/app(\/|$)/.test(pathname)) return null;
  return children;
}
