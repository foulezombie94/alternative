import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { locales } from "@/i18n/config";
import en from "@/i18n/dictionaries/en";
import fr from "@/i18n/dictionaries/fr";

export const alt = "alternative";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const paper = "#f6f5f1";
const ink = "#17171a";
const accent = "#e5471c";

async function fonts() {
  const weights = { normal: 400, semibold: 600 } as const;
  return Promise.all(
    Object.entries(weights).map(async ([file, weight]) => ({
      name: "SN Pro",
      weight,
      data: await readFile(path.join(process.cwd(), `src/assets/fonts/sn-pro-${file}.ttf`)),
    })),
  );
}

function Mark({ size: side }: { size: number }) {
  return (
    <svg width={side} height={side} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill={ink} />
      <circle cx="14" cy="17.5" r="5.5" fill="none" strokeWidth="3.4" stroke={paper} />
      <path d="M22.3 10.2v12.6" fill="none" strokeWidth="3.4" strokeLinecap="round" stroke={accent} />
    </svg>
  );
}

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = (lang === "en" ? en : fr).webApp;
  const chips = [t.nav.grades, t.nav.timetable, t.nav.homework, t.nav.messages];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        backgroundColor: paper,
        color: ink,
        fontFamily: "SN Pro",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Mark size={72} />
        <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1 }}>{t.brand}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, maxWidth: 940 }}>
          {t.ogHeadline}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.35, color: "rgba(23, 23, 26, 0.6)", maxWidth: 900 }}>
          {t.metadataDescription}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {chips.map((chip) => (
          <div
            key={chip}
            style={{
              display: "flex",
              padding: "10px 22px",
              borderRadius: 999,
              border: "2px solid rgba(23, 23, 26, 0.12)",
              backgroundColor: "#ffffff",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {chip}
          </div>
        ))}
      </div>
    </div>,
    { ...size, fonts: await fonts() },
  );
}
