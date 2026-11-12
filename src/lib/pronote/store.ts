import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PendingChallenge, PronoteCredentials } from "./pronote";
import type { SchoolService } from "./service";

export const sessionCookie = "papillon_web_session";

export type SessionPayload =
  | { id: string; kind: "demo" }
  | { id: string; kind: "challenge" }
  | { id: string; kind: "pronote"; credentials: PronoteCredentials };

const idleLimit = 3 * 60 * 60 * 1000;
const challengeLimit = 10 * 60 * 1000;

const secret = process.env.PAPILLON_SESSION_SECRET ?? "papillon-web-dev-secret-change-me";
const key = createHash("sha256").update(secret).digest();

type Entry<T> = { value: T; lastUsed: number };

type Store = {
  services: Map<string, Entry<SchoolService>>;
  challenges: Map<string, Entry<PendingChallenge>>;
  restoring: Map<string, Promise<SchoolService>>;
};

const globalStore = globalThis as typeof globalThis & { papillonWebStore?: Store };

const store: Store = (globalStore.papillonWebStore ??= {
  services: new Map(),
  challenges: new Map(),
  restoring: new Map(),
});

function sweep() {
  const now = Date.now();
  for (const [id, entry] of store.services) {
    if (now - entry.lastUsed > idleLimit) {
      entry.value.logout();
      store.services.delete(id);
    }
  }
  for (const [id, entry] of store.challenges) {
    if (now - entry.lastUsed > challengeLimit) store.challenges.delete(id);
  }
}

export function newSessionId() {
  return randomBytes(24).toString("base64url");
}

export function sealSession(payload: SessionPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function openSession(value: string | undefined): SessionPayload | undefined {
  if (!value) return undefined;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return undefined;
  }
}

export function saveService(id: string, service: SchoolService) {
  sweep();
  store.challenges.delete(id);
  const previous = store.services.get(id)?.value;
  if (previous && previous !== service) previous.logout();
  store.services.set(id, { value: service, lastUsed: Date.now() });
}

export async function getService(
  id: string | undefined,
  restore: () => Promise<SchoolService> | undefined,
  isCurrent: (service: SchoolService) => boolean = () => true,
): Promise<SchoolService | undefined> {
  if (!id) return undefined;
  const entry = store.services.get(id);
  if (entry && isCurrent(entry.value)) {
    entry.lastUsed = Date.now();
    return entry.value;
  }
  if (entry) {
    entry.value.logout();
    store.services.delete(id);
  }

  let pending = store.restoring.get(id);
  if (!pending) {
    const restoring = restore();
    if (!restoring) return undefined;
    pending = restoring.then((service) => {
      saveService(id, service);
      return service;
    });
    store.restoring.set(id, pending);
    pending.finally(() => store.restoring.delete(id)).catch(() => undefined);
  }
  return pending;
}

export function removeService(id: string | undefined) {
  if (!id) return;
  store.services.get(id)?.value.logout();
  store.services.delete(id);
  store.challenges.delete(id);
}

export function saveChallenge(id: string, challenge: PendingChallenge) {
  sweep();
  store.challenges.set(id, { value: challenge, lastUsed: Date.now() });
}

export function takeChallenge(id: string | undefined) {
  if (!id) return undefined;
  const entry = store.challenges.get(id);
  store.challenges.delete(id);
  return entry?.value;
}
