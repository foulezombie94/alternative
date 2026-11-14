"use client";

import { Archive, Code, ExternalLink, Gallery, Link, Paper } from "@getpapillon/papicons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/ui/spinner";
import type { AttachmentDTO } from "@/lib/pronote/types";
import { easeOutPapillon } from "@/lib/motion";
import { useWebApp } from "./context";

type Kind = "pdf" | "image" | "web" | "text" | "office" | "archive" | "link" | "other";

const extensions: Record<string, Kind> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  html: "web",
  htm: "web",
  txt: "text",
  md: "text",
  csv: "text",
  css: "text",
  js: "text",
  json: "text",
  py: "text",
  c: "text",
  java: "text",
  doc: "office",
  docx: "office",
  odt: "office",
  xls: "office",
  xlsx: "office",
  ods: "office",
  ppt: "office",
  pptx: "office",
  odp: "office",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
};

const icons = {
  pdf: Paper,
  image: Gallery,
  web: Code,
  text: Paper,
  office: Paper,
  archive: Archive,
  link: Link,
  other: Paper,
} satisfies Record<Kind, unknown>;

const previewable: Kind[] = ["pdf", "image", "web", "text"];

const previewWidth = 352;
const previewHeight = 416;
const margin = 12;

type Described = { kind: Kind; base: string; detail: string; hosted: boolean };

function describe(file: AttachmentDTO): Described {
  const hosted = file.url.includes("/FichiersExternes/");
  if (!hosted && /^https?:\/\//i.test(file.url)) {
    let host = file.url;
    try {
      host = new URL(file.url).host.replace(/^www\./, "");
    } catch {}
    return { kind: "link", base: file.name || host, detail: host, hosted };
  }
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return {
    kind: extensions[extension] ?? "other",
    base: dot > 0 ? file.name.slice(0, dot) : file.name,
    detail: extension,
    hosted,
  };
}

type Loaded = { kind: "url"; url: string } | { kind: "text"; text: string } | { kind: "pdf"; data: ArrayBuffer };

const cache = new Map<string, Promise<Loaded>>();

function load(file: AttachmentDTO, kind: Kind) {
  let pending = cache.get(file.url);
  if (!pending) {
    pending = fetch(`/api/pronote/file?u=${encodeURIComponent(file.url)}`).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      if (kind === "text" || kind === "web") return { kind: "text", text: await response.text() };
      if (kind === "pdf") return { kind: "pdf", data: await response.arrayBuffer() };
      return { kind: "url", url: URL.createObjectURL(await response.blob()) };
    });
    pending.catch(() => cache.delete(file.url));
    cache.set(file.url, pending);
  }
  return pending;
}

function PdfPage({ data, onError }: { data: ArrayBuffer; onError: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | undefined;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      }
      const document = await pdfjs.getDocument({ data: data.slice(0) }).promise;
      const page = await document.getPage(1);
      const element = canvas.current;
      if (!element || cancelled) return;
      const width = element.parentElement?.clientWidth ?? previewWidth;
      const scale = (width / page.getViewport({ scale: 1 }).width) * window.devicePixelRatio;
      const viewport = page.getViewport({ scale });
      element.width = viewport.width;
      element.height = viewport.height;
      task = page.render({ canvas: element, viewport });
      await task.promise;
    })().catch(() => !cancelled && onError());
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [data, onError]);

  return (
    <div className="size-full overflow-hidden p-3">
      <canvas ref={canvas} className="h-auto w-full rounded-sm bg-white shadow-sm" />
    </div>
  );
}

function PreviewBody({ file, info }: { file: AttachmentDTO; info: Described }) {
  const { t } = useWebApp();
  const canPreview = info.hosted && previewable.includes(info.kind);
  const [state, setState] = useState<{ url: string; loaded?: Loaded; failed?: boolean }>({ url: "" });

  useEffect(() => {
    if (!canPreview) return;
    let active = true;
    load(file, info.kind).then(
      (loaded) => active && setState({ url: file.url, loaded }),
      () => active && setState({ url: file.url, failed: true }),
    );
    return () => {
      active = false;
    };
  }, [canPreview, file, info.kind]);

  const fail = useCallback(() => setState({ url: file.url, failed: true }), [file.url]);

  const message = (text: string) => (
    <p className="m-auto max-w-60 text-center text-sm text-foreground/60">{text}</p>
  );

  if (info.kind === "link") {
    return (
      <div className="m-auto flex max-w-full flex-col items-center gap-3 p-4 text-center">
        <Link className="size-8 text-foreground/40" />
        <p className="text-sm font-medium">{t.common.externalLink}</p>
        <p className="font-mono text-xs break-all text-foreground/60">{file.url}</p>
      </div>
    );
  }
  if (!info.hosted) return message(t.common.previewDemo);
  if (!canPreview) return message(t.common.previewUnavailable);

  const current: { loaded?: Loaded; failed?: boolean } = state.url === file.url ? state : {};
  if (current.failed) return message(t.common.previewFailed);
  if (!current.loaded) {
    return (
      <div className="m-auto flex items-center gap-2 text-sm text-foreground/60">
        <Spinner className="size-4" />
        {t.common.previewLoading}
      </div>
    );
  }

  const loaded = current.loaded;
  if (loaded.kind === "pdf") {
    return <PdfPage data={loaded.data} onError={fail} />;
  }
  if (loaded.kind === "text") {
    if (info.kind === "web") {
      return <iframe title={file.name} sandbox="" srcDoc={loaded.text} className="size-full bg-white" />;
    }
    return (
      <pre className="size-full overflow-hidden p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
        {loaded.text.slice(0, 4000)}
      </pre>
    );
  }
  if (info.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- blob local, non optimisable
    return <img src={loaded.url} alt="" className="m-auto max-h-full max-w-full object-contain" />;
  }
  return message(t.common.previewUnavailable);
}

function Preview({ file, anchor }: { file: AttachmentDTO; anchor: DOMRect }) {
  const { t } = useWebApp();
  const reduceMotion = useReducedMotion();
  const info = describe(file);
  const Icon = icons[info.kind];

  const fitsRight = anchor.right + margin + previewWidth < window.innerWidth;
  const left = fitsRight
    ? anchor.right + margin
    : Math.max(margin, Math.min(anchor.left - margin - previewWidth, window.innerWidth - previewWidth - margin));
  const top = Math.max(
    margin,
    Math.min(anchor.top + anchor.height / 2 - previewHeight / 2, window.innerHeight - previewHeight - margin),
  );

  return (
    <motion.div
      role="tooltip"
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
      transition={{ duration: 0.18, ease: easeOutPapillon }}
      style={{ left, top, width: previewWidth, height: previewHeight }}
      className="pointer-events-none fixed z-50 flex flex-col overflow-hidden rounded-xl border border-foreground/10 bg-surface shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
        <Icon className="size-4 shrink-0 text-foreground/50" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
        <span className="shrink-0 font-mono text-xs text-foreground/40 uppercase">{t.common.preview}</span>
      </div>
      <div className="flex min-h-0 flex-1 bg-background">
        <PreviewBody file={file} info={info} />
      </div>
    </motion.div>
  );
}

export function Attachments({ files }: { files: AttachmentDTO[] }) {
  const { t } = useWebApp();
  const [hovered, setHovered] = useState<{ file: AttachmentDTO; anchor: DOMRect; host: Element } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!hovered) return;
    const close = () => setHovered(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [hovered]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!files.length) return null;

  const enter = (file: AttachmentDTO) => (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse") return;
    const target = event.currentTarget;
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        setHovered({
          file,
          anchor: target.getBoundingClientRect(),
          host: target.closest(".theme-app") ?? document.body,
        }),
      350,
    );
  };
  const leave = () => {
    clearTimeout(timer.current);
    setHovered(null);
  };

  return (
    <div className="@container mt-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground/50">
        {t.common.attachments}
        <span className="font-mono text-xs">{files.length}</span>
      </p>
      <ul className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3">
        {files.map((file, index) => {
          const info = describe(file);
          const Icon = icons[info.kind];
          return (
            <li key={`${index}-${file.url}`} className="min-w-0">
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                onPointerEnter={enter(file)}
                onPointerLeave={leave}
                onClick={leave}
                className="group flex h-full items-center gap-3 rounded-lg border border-foreground/10 bg-surface p-2 pr-3 transition-colors hover:border-foreground/30"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground/5 text-foreground/70 transition-colors group-hover:bg-foreground group-hover:text-background">
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="line-clamp-2 text-sm leading-snug font-medium wrap-anywhere">{info.base}</span>
                  <span className="truncate text-xs text-foreground/50">
                    {t.common.fileKinds[info.kind]}
                    {info.detail && info.kind !== "link" && info.detail.toUpperCase() !== t.common.fileKinds[info.kind].toUpperCase() && (
                      <span className="font-mono uppercase"> · {info.detail}</span>
                    )}
                    {info.kind === "link" && <span> · {info.detail}</span>}
                  </span>
                </span>
                <ExternalLink className="size-4 shrink-0 text-foreground/30 transition-colors group-hover:text-foreground" />
              </a>
            </li>
          );
        })}
      </ul>
      {hovered &&
        createPortal(
          <AnimatePresence>
            <Preview key={hovered.file.url} file={hovered.file} anchor={hovered.anchor} />
          </AnimatePresence>,
          hovered.host,
        )}
    </div>
  );
}
