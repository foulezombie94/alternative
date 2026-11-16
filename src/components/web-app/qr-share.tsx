"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { call } from "./api";
import { useWebApp } from "./context";

type Generated = { image: string; pin: string; expiresAt: number };

function remaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Countdown({ expiresAt, onExpired }: { expiresAt: number; onExpired: () => void }) {
  const { t } = useWebApp();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) onExpired();
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  return <p className="font-mono text-sm text-foreground/60">{t.account.qrExpires.replace("{time}", remaining(expiresAt - now))}</p>;
}

export function QrShare() {
  const { t } = useWebApp();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  const generate = async () => {
    if (!/^\d{4}$/.test(pin)) return;
    setLoading(true);
    setFailed(false);
    setExpired(false);
    try {
      const result = await call<{ data: string | null; expiresAt: string | null; pronoteUrl: string }>("qrCode", { pin });
      if (!result.data || !result.expiresAt) {
        setRefused(result.pronoteUrl);
        return;
      }
      setRefused(null);
      const image = await QRCode.toDataURL(result.data, { margin: 2, width: 320, errorCorrectionLevel: "M" });
      setGenerated({ image, pin, expiresAt: new Date(result.expiresAt).getTime() });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setGenerated(null);
    setExpired(false);
    setPin("");
  };

  return (
    <section className="flex flex-col gap-3">
      {generated && !expired ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src={generated.image}
            alt={t.account.qrAlt}
            width={240}
            height={240}
            unoptimized
            className="size-60 rounded-md bg-white"
          />
          <Countdown expiresAt={generated.expiresAt} onExpired={() => setExpired(true)} />
          <p className="text-sm text-foreground/70">{t.account.qrSteps.replace("{pin}", generated.pin)}</p>
          <button type="button" onClick={reset} className="text-sm font-medium text-primary hover:underline">
            {t.account.qrNew}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground/70">{expired ? t.account.qrExpired : t.account.qrHint}</p>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <label className="sr-only" htmlFor="qr-pin">
              {t.account.qrPin}
            </label>
            <input
              id="qr-pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder={t.account.qrPin}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-40 rounded-md border border-foreground/10 bg-background px-3 py-2 font-mono tracking-widest outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={pin.length !== 4 || loading}
              className="rounded-md bg-primary px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t.account.qrGenerating : t.account.qrGenerate}
            </button>
          </form>
          {refused && (
            <div className="flex flex-col items-start gap-3 rounded-md bg-foreground/5 p-3">
              <p className="text-sm text-foreground/80">{t.account.qrRefused}</p>
              <a
                href={refused}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t.account.qrOpenPronote}
              </a>
            </div>
          )}
          {failed && (
            <p className="text-sm text-accent" role="alert">
              {t.account.qrFailed}
            </p>
          )}
        </>
      )}
    </section>
  );
}
