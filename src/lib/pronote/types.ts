export const features = ["timetable", "homework", "grades", "attendance", "news", "chat", "canteen"] as const;

export type Feature = (typeof features)[number];

export type Score = { value: number | null; label?: string };

export type AttachmentDTO = { name: string; url: string };

export type ProfileDTO = {
  name: string;
  firstName: string;
  className?: string;
  school: string;
  demo: boolean;
  features: Feature[];
};

export const CourseKind = { Lesson: "lesson", Detention: "detention", Activity: "activity" } as const;
export type CourseKind = (typeof CourseKind)[keyof typeof CourseKind];

export const CourseState = { Canceled: "canceled", Edited: "edited", Test: "test" } as const;
export type CourseState = (typeof CourseState)[keyof typeof CourseState];

export type CourseDTO = {
  id: string;
  kind: CourseKind;
  subject: string;
  from: string;
  to: string;
  room?: string;
  teacher?: string;
  group?: string;
  color?: string;
  state?: CourseState;
  statusText?: string;
  notes?: string;
  resourceId?: string;
};

export type CourseResourceDTO = {
  title?: string;
  description?: string;
  attachments: AttachmentDTO[];
};

export type HomeworkDTO = {
  id: string;
  subject: string;
  content: string;
  dueDate: string;
  done: boolean;
  color?: string;
  attachments: AttachmentDTO[];
  uploadRequired: boolean;
  minutes?: number;
};

export type PeriodDTO = { id: string; name: string; start: string; end: string };

export type PeriodsDTO = { periods: PeriodDTO[]; defaultId?: string };

export type GradeDTO = {
  id: string;
  description: string;
  date?: string;
  coefficient: number;
  outOf: Score;
  value: Score;
  average: Score;
  min: Score;
  max: Score;
  bonus: boolean;
  optional: boolean;
  subjectFile?: AttachmentDTO;
  correctionFile?: AttachmentDTO;
};

export type SubjectDTO = {
  id: string;
  name: string;
  color?: string;
  average: Score;
  classAverage: Score;
  min: Score;
  max: Score;
  outOf: Score;
  grades: GradeDTO[];
};

export type GradesDTO = {
  overall: Score;
  classOverall: Score;
  subjects: SubjectDTO[];
};

export type AbsenceDTO = { id: string; from: string; to: string; reason?: string; justified: boolean; minutes: number };
export type DelayDTO = { id: string; date: string; reason?: string; justified: boolean; minutes: number };
export type PunishmentDTO = {
  id: string;
  date: string;
  nature: string;
  givenBy: string;
  reason: string;
  circumstances: string;
  work: string;
  minutes: number;
  exclusion: boolean;
};
export type ObservationDTO = { id: string; date: string; name: string; subject?: string; reason?: string; positive: boolean };

export type AttendanceDTO = {
  absences: AbsenceDTO[];
  delays: DelayDTO[];
  punishments: PunishmentDTO[];
  observations: ObservationDTO[];
};

export type NewsDTO = {
  id: string;
  title: string;
  author: string;
  category: string;
  date: string;
  content: string;
  read: boolean;
  needsAcknowledgement: boolean;
  acknowledged: boolean;
  attachments: AttachmentDTO[];
};

export type NewsDetailDTO = {
  content: string;
  attachments: AttachmentDTO[];
  needsAcknowledgement: boolean;
  acknowledged: boolean;
};

export type ChatDTO = {
  id: string;
  subject: string;
  with: string;
  date: string;
  unread: number;
  messages: number;
};

export type MessageDTO = {
  id: string;
  author: string;
  mine: boolean;
  date: string;
  content: string;
  attachments: AttachmentDTO[];
};

export type ChatThreadDTO = { messages: MessageDTO[]; canReply: boolean };

export type RecipientDTO = { id: string; name: string; detail?: string };

export type DishesDTO = Partial<Record<"entry" | "main" | "side" | "cheese" | "dessert" | "drink", string[]>>;

export type MenuDayDTO = { date: string; lunch?: DishesDTO; dinner?: DishesDTO };

export type SchoolDTO = { name: string; url: string; distance: number; postalCode: number };

export type InstanceDTO = { name: string; url: string; ent: boolean };

export type LoginResult = { status: "ok" } | { status: "pin"; requiresSource: boolean };

export type ApiError = { error: string; code: ErrorCode };

export type ErrorCode =
  | "bad_credentials"
  | "not_logged_in"
  | "session_expired"
  | "unreachable"
  | "suspended"
  | "rate_limited"
  | "security"
  | "invalid_qr"
  | "invalid_pin"
  | "server"
  | "ent_required"
  | "unsupported"
  | "unknown";
