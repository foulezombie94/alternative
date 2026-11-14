import type { NewsQuestion, SessionHandle } from "@blockshub/pawnote-lts";

export * from "@blockshub/pawnote-lts";

export declare const newsDetail: (session: SessionHandle, raw: unknown) => Promise<NewsQuestion[]>;

export declare const homepageRaw: (session: SessionHandle, day?: Date) => Promise<Record<string, unknown>>;
