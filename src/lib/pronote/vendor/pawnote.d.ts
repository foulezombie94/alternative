import type { NewsInformation, NewsQuestion, SessionHandle } from "@blockshub/pawnote-lts";

export * from "@blockshub/pawnote-lts";

export declare const newsDetail: (session: SessionHandle, raw: unknown) => Promise<NewsQuestion[]>;

export declare const homepageRaw: (session: SessionHandle, day?: Date) => Promise<Record<string, unknown>>;
export declare const casierRaw: (session: SessionHandle) => Promise<Record<string, unknown>>;
export declare const bulletinBIAPdf: (session: SessionHandle, bulletin: Record<string, unknown>) => Promise<string>;
export declare const newsAcknowledgeExact: (session: SessionHandle, information: NewsInformation) => Promise<void>;
export type SurveySendQuestion = {
  id: string;
  fullTitle: string;
  kind: number;
  answerID?: string;
  shouldAnswer?: boolean;
  selected?: number[];
  text?: string;
  free?: boolean;
};
export declare const newsSurveyExact: (
  session: SessionHandle,
  survey: { id: string; title?: string; public?: unknown },
  questions: SurveySendQuestion[],
) => Promise<void>;
