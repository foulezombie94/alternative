"use client";

import { Camera, Lock, MapPin, Pronote, QrCode, Sparkles } from "@getpapillon/papicons";
import jsQR from "jsqr";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/spinner";
import type { Locale } from "@/i18n/config";
import type { WebAppDictionary } from "@/i18n/dictionaries/web-app/fr";
import type { ErrorCode, InstanceDTO, LoginResult, SchoolDTO } from "@/lib/pronote/types";
import { ApiFailure, call } from "./api";

type Tab = "credentials" | "qr" | "demo";
type QrData = { jeton: string; login: string; url: string };

const input =
  "w-full rounded-2xl bg-surface px-4 py-3 outline-none transition-shadow placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-primary";
const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white transition-[opacity,scale] hover:opacity-90 active:scale-98 disabled:opacity-50";
const secondaryButton =
  "flex items-center justify-center gap-2 rounded-full bg-surface px-4 py-2.5 font-medium transition-colors hover:bg-foreground/10 disabled:opacity-50";

function readQr(text: string | undefined): QrData | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (typeof data.jeton === "string" && typeof data.login === "string" && typeof data.url === "string") return data;
  } catch {
    return null;
  }
  return null;
}

function decodeImage(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return readQr(jsQR(pixels.data, width, height)?.data);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-sm text-foreground/50">{hint}</span>}
    </label>
  );
}

export function WebAppLogin({ t, locale }: { t: WebAppDictionary; locale: Locale }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("credentials");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [needsPin, setNeedsPin] = useState(false);

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parent, setParent] = useState(false);
  const [schools, setSchools] = useState<SchoolDTO[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [instance, setInstance] = useState<InstanceDTO | null>(null);

  const [qr, setQr] = useState<QrData | null>(null);
  const [qrMissing, setQrMissing] = useState(false);
  const [qrPin, setQrPin] = useState("");
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [pin, setPin] = useState("");

  const home = `/${locale}/app` as Route;

  async function submit(action: () => Promise<LoginResult>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.status === "pin") {
        setNeedsPin(true);
      } else {
        router.replace(home);
      }
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.code : "unknown");
    } finally {
      setBusy(false);
    }
  }

  function loginCredentials(event: FormEvent) {
    event.preventDefault();
    submit(() => call<LoginResult>("loginCredentials", { url, username, password, parent }));
  }

  function loginQr(event: FormEvent) {
    event.preventDefault();
    if (!qr) return;
    submit(() => call<LoginResult>("loginQr", { qr, pin: qrPin }));
  }

  function solvePin(event: FormEvent) {
    event.preventDefault();
    submit(() => call<LoginResult>("solveChallenge", { pin }));
  }

  function locate() {
    setLocationError(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setSchools(await call<SchoolDTO[]>("geolocate", { latitude: coords.latitude, longitude: coords.longitude }));
        } catch (failure) {
          setError(failure instanceof ApiFailure ? failure.code : "unknown");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { timeout: 15000 },
    );
  }

  async function checkUrl() {
    setError(null);
    setInstance(null);
    try {
      setInstance(await call<InstanceDTO>("instance", { url }));
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.code : "unknown");
    }
  }

  function pickImage(file: File | undefined) {
    if (!file) return;
    setQrMissing(false);
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const data = decodeImage(image, Math.round(image.width * scale), Math.round(image.height * scale));
      URL.revokeObjectURL(objectUrl);
      setQr(data);
      setQrMissing(!data);
    };
    image.src = objectUrl;
  }

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;

    const scan = () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const data = decodeImage(video, video.videoWidth, video.videoHeight);
        if (data) {
          setQr(data);
          setQrMissing(false);
          setCamera(false);
          return;
        }
      }
      frame = requestAnimationFrame(scan);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((media) => {
        stream = media;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = media;
        videoRef.current.play().catch(() => undefined);
        frame = requestAnimationFrame(scan);
      })
      .catch(() => {
        setCamera(false);
        setQrMissing(true);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [camera]);

  const tabs: { id: Tab; icon: typeof Lock }[] = [
    { id: "credentials", icon: Lock },
    { id: "qr", icon: QrCode },
    { id: "demo", icon: Sparkles },
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-5 py-12">
      <div className="w-full max-w-lg">
        <Link href={`/${locale}` as Route} className="mb-8 flex justify-center text-primary">
          <Logo aria-hidden className="h-8" />
        </Link>

        <div className="rounded-4xl bg-background p-6 shadow-xl shadow-foreground/5 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Pronote className="size-8 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">{needsPin ? t.login.pinTitle : t.login.title}</h1>
              <p className="text-sm text-foreground/50">{needsPin ? t.login.pinText : t.login.subtitle}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-5 rounded-2xl bg-feature-schedule/10 px-4 py-3 text-feature-schedule">
              {t.errors[error]}
            </p>
          )}

          {needsPin ? (
            <form onSubmit={solvePin} className="flex flex-col gap-4">
              <Field label={t.login.pinLabel}>
                <input
                  className={input}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </Field>
              <button type="submit" className={primaryButton} disabled={busy || !pin}>
                {busy && <Spinner className="size-5" />}
                {t.login.pinSubmit}
              </button>
            </form>
          ) : (
            <>
              <div role="tablist" className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-surface p-1">
                {tabs.map(({ id, icon: TabIcon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => {
                      setTab(id);
                      setError(null);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                      tab === id ? "bg-background shadow-sm" : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    <TabIcon className="size-4" />
                    {t.login.tabs[id]}
                  </button>
                ))}
              </div>

              {tab === "credentials" && (
                <form onSubmit={loginCredentials} className="flex flex-col gap-4">
                  <Field label={t.login.url} hint={t.login.urlHint}>
                    <input
                      className={input}
                      type="url"
                      placeholder={t.login.urlPlaceholder}
                      value={url}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setInstance(null);
                      }}
                      required
                    />
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryButton} onClick={locate} disabled={locating}>
                      {locating ? <Spinner className="size-4" /> : <MapPin className="size-4" />}
                      {locating ? t.login.findingSchool : t.login.findSchool}
                    </button>
                    <button type="button" className={secondaryButton} onClick={checkUrl} disabled={!url}>
                      {t.login.checkUrl}
                    </button>
                  </div>

                  {locationError && <p className="text-sm text-feature-schedule">{t.login.locationDenied}</p>}

                  {schools && (
                    <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface p-2">
                      {!schools.length && <li className="p-3 text-foreground/50">{t.login.noSchool}</li>}
                      {schools.map((school) => (
                        <li key={school.url}>
                          <button
                            type="button"
                            onClick={() => {
                              setUrl(school.url);
                              setSchools(null);
                              setInstance(null);
                            }}
                            className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-background"
                          >
                            <span className="block font-medium">{school.name}</span>
                            <span className="text-sm text-foreground/50">
                              {school.postalCode} · {(school.distance / 1000).toFixed(1)} km
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {instance && (
                    <div className="rounded-2xl bg-primary/10 px-4 py-3 text-sm">
                      <p>
                        {t.login.instanceFound} <strong>{instance.name}</strong>
                      </p>
                      {instance.ent && <p className="mt-1 text-feature-homework">{t.login.entWarning}</p>}
                    </div>
                  )}

                  <Field label={t.login.username}>
                    <input
                      className={input}
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t.login.password}>
                    <input
                      className={input}
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={parent}
                      onChange={(event) => setParent(event.target.checked)}
                      className="size-5 accent-primary"
                    />
                    {t.login.parent}
                  </label>
                  <button type="submit" className={primaryButton} disabled={busy}>
                    {busy && <Spinner className="size-5" />}
                    {busy ? t.login.submitting : t.login.submit}
                  </button>
                </form>
              )}

              {tab === "qr" && (
                <form onSubmit={loginQr} className="flex flex-col gap-4">
                  <p className="text-foreground/70">{t.login.qrIntro}</p>
                  <div className="flex flex-wrap gap-2">
                    <label className={`${secondaryButton} cursor-pointer`}>
                      <QrCode className="size-4" />
                      {t.login.qrUpload}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => pickImage(event.target.files?.[0])}
                      />
                    </label>
                    <button type="button" className={secondaryButton} onClick={() => setCamera((value) => !value)}>
                      <Camera className="size-4" />
                      {camera ? t.login.qrStopCamera : t.login.qrCamera}
                    </button>
                  </div>
                  {camera && (
                    <video ref={videoRef} muted playsInline className="aspect-square w-full rounded-2xl bg-foreground object-cover" />
                  )}
                  {qr && (
                    <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
                      {t.login.qrDetected} · {new URL(qr.url).host}
                    </p>
                  )}
                  {qrMissing && <p className="text-sm text-feature-schedule">{t.login.qrNotFound}</p>}
                  <Field label={t.login.qrPin}>
                    <input
                      className={input}
                      inputMode="numeric"
                      maxLength={4}
                      value={qrPin}
                      onChange={(event) => setQrPin(event.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </Field>
                  <button type="submit" className={primaryButton} disabled={busy || !qr || qrPin.length !== 4}>
                    {busy && <Spinner className="size-5" />}
                    {busy ? t.login.submitting : t.login.submit}
                  </button>
                </form>
              )}

              {tab === "demo" && (
                <div className="flex flex-col gap-4">
                  <p className="text-foreground/70">{t.login.demoIntro}</p>
                  <button
                    type="button"
                    className={primaryButton}
                    disabled={busy}
                    onClick={() => submit(() => call<LoginResult>("loginDemo"))}
                  >
                    {busy && <Spinner className="size-5" />}
                    {t.login.demoButton}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-foreground/50">{t.login.localOnly}</p>
      </div>
    </main>
  );
}
