"use client";

import { Add } from "@getpapillon/papicons";
import { type FormEvent, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { ChatDTO, ChatThreadDTO, RecipientDTO } from "@/lib/pronote/types";
import { ApiFailure, call, useApi } from "./api";
import { useWebApp } from "./context";
import { formatShortDate, formatTime } from "./format";
import { Async, Attachments, Dialog, Empty, ErrorBox, Html, PageHeader } from "./ui";

const field =
  "w-full rounded-2xl bg-surface px-4 py-3 outline-none placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-primary";

function Thread({ chat, onSent }: { chat: ChatDTO; onSent: () => void }) {
  const { t, locale } = useWebApp();
  const state = useApi<ChatThreadDTO>("chatMessages", { id: chat.id });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await call("sendMessage", { id: chat.id, content: draft });
      setDraft("");
      state.reload();
      onSent();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure : new ApiFailure("unknown", String(failure)));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 border-b border-foreground/5 pb-4">
        <h2 className="text-xl font-semibold">{chat.subject}</h2>
        <p className="text-sm text-foreground/50">{chat.with}</p>
      </div>
      <Async state={state}>
        {(thread) => (
          <>
            <ul className="flex flex-1 flex-col gap-3">
              {thread.messages.map((message) => (
                <li key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-11/12 rounded-3xl px-4 py-3 sm:max-w-4/5 ${
                      message.mine ? "bg-primary text-white [&_a]:text-white" : "bg-background"
                    }`}
                  >
                    <p className={`mb-1 text-xs font-medium ${message.mine ? "text-white/70" : "text-foreground/50"}`}>
                      {message.mine ? t.messages.me : message.author} · {formatShortDate(message.date, locale)}{" "}
                      {formatTime(message.date, locale)}
                    </p>
                    <Html html={message.content} />
                    <Attachments files={message.attachments} />
                  </div>
                </li>
              ))}
            </ul>
            {thread.canReply ? (
              <form onSubmit={send} className="mt-5 flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t.messages.reply}
                  rows={2}
                  className={`${field} resize-none bg-background`}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {sending && <Spinner className="size-4" />}
                  {t.messages.send}
                </button>
              </form>
            ) : (
              <p className="mt-5 text-sm text-foreground/50">{t.messages.cannotReply}</p>
            )}
            {error && <ErrorBox error={error} />}
          </>
        )}
      </Async>
    </div>
  );
}

function NewChat({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useWebApp();
  const recipients = useApi<RecipientDTO[]>("recipients");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (recipients.data ?? []).filter(
      (recipient) => !query || `${recipient.name} ${recipient.detail ?? ""}`.toLowerCase().includes(query),
    );
  }, [recipients.data, search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await call("createChat", { subject, content, recipientIds: picked });
      onCreated();
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure : new ApiFailure("unknown", String(failure)));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog title={t.messages.newMessage} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <p className="mb-2 font-medium">{t.messages.recipients}</p>
          <input
            className={field}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.messages.searchRecipients}
          />
          <Async state={recipients}>
            {() => (
              <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {filtered.map((recipient) => {
                  const checked = picked.includes(recipient.id);
                  return (
                    <li key={recipient.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface">
                        <input
                          type="checkbox"
                          checked={checked}
                          className="size-4 accent-primary"
                          onChange={() =>
                            setPicked((list) =>
                              checked ? list.filter((id) => id !== recipient.id) : [...list, recipient.id],
                            )
                          }
                        />
                        <span>
                          <span className="block font-medium">{recipient.name}</span>
                          {recipient.detail && <span className="text-sm text-foreground/50">{recipient.detail}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Async>
        </div>
        <label className="flex flex-col gap-2">
          <span className="font-medium">{t.messages.subject}</span>
          <input className={field} value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-medium">{t.messages.content}</span>
          <textarea
            className={`${field} resize-y`}
            rows={5}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        </label>
        {error && <ErrorBox error={error} />}
        <button
          type="submit"
          disabled={sending || !picked.length || !subject.trim() || !content.trim()}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {sending && <Spinner className="size-4" />}
          {sending ? t.messages.sending : t.messages.send}
        </button>
      </form>
    </Dialog>
  );
}

export function WebAppMessages() {
  const { t, locale } = useWebApp();
  const state = useApi<ChatDTO[]>("chats");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  return (
    <>
      <PageHeader title={t.nav.messages}>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Add className="size-5" />
          {t.messages.newMessage}
        </button>
      </PageHeader>
      <Async state={state} empty={t.common.empty} isEmpty={(list) => !list.length}>
        {(list) => {
          const selected = list.find((chat) => chat.id === selectedId) ?? list[0];
          return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <ul className="flex flex-col gap-2 lg:col-span-2">
                {list.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(chat.id)}
                      className={`w-full rounded-2xl p-4 text-left transition-colors ${
                        chat.id === selected?.id ? "bg-primary/10" : "bg-surface hover:bg-foreground/5"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{chat.subject}</span>
                        <span className="shrink-0 text-xs text-foreground/50">{formatShortDate(chat.date, locale)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-sm text-foreground/50">
                        <span className="truncate">{chat.with}</span>
                        {chat.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-primary px-2 text-xs font-semibold text-white">
                            {chat.unread} {t.messages.unread}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <section className="rounded-3xl bg-surface p-6 lg:col-span-3">
                {selected ? (
                  <Thread key={selected.id} chat={selected} onSent={state.reload} />
                ) : (
                  <Empty>{t.messages.select}</Empty>
                )}
              </section>
            </div>
          );
        }}
      </Async>
      {composing && <NewChat onClose={() => setComposing(false)} onCreated={state.reload} />}
    </>
  );
}
