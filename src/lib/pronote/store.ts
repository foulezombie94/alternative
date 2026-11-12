import { randomBytes } from "node:crypto";
import type { PendingChallenge } from "./pronote";
import type { SchoolService } from "./service";

export const sessionCookie = "papillon_web_session";

const idleLimit = 3 * 60 * 60 * 1000;
const challengeLimit = 10 * 60 * 1000;

type Entry<T> = { value: T; lastUsed: number };

type Store = {
  services: Map<string, Entry<SchoolService>>;
  challenges: Map<string, Entry<PendingChallenge>>;
};

const globalStore = globalThis as typeof globalThis & { papillonWebStore?: Store };

const store: Store = (globalStore.papillonWebStore ??= { services: new Map(), challenges: new Map() });

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
  return randomBytes(32).toString("base64url");
}

export function saveService(id: string, service: SchoolService) {
  sweep();
  store.challenges.delete(id);
  store.services.get(id)?.value.logout();
  store.services.set(id, { value: service, lastUsed: Date.now() });
}

export function getService(id: string | undefined) {
  if (!id) return undefined;
  const entry = store.services.get(id);
  if (!entry) return undefined;
  entry.lastUsed = Date.now();
  return entry.value;
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
