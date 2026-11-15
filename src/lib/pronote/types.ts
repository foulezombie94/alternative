export const features = ["timetable", "homework", "grades", "attendance", "news", "chat", "contents", "report", "evaluations", "documents"] as const;

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

export type AccountDTO = {
  name: string;
  className?: string;
  school: string;
  delegate: boolean;
  detailsAvailable: boolean;
  email?: string;
  phone?: string;
  address?: string;
  ine?: string;
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

export type HolidayDTO = { name: string; start: string; end: string };

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

export type LessonContentDTO = {
  id: string;
  subject: string;
  color?: string;
  date: string;
  teachers: string[];
  contents: CourseResourceDTO[];
};

export type ReportSubjectDTO = {
  name: string;
  group?: string;
  teachers: string[];
  coefficient: number;
  average: Score;
  classAverage: Score;
  min: Score;
  max: Score;
  assessments: string[];
};

export type ReportCardDTO = {
  message?: string;
  subjects: ReportSubjectDTO[];
  overall: { name: string; value: string }[];
  raw?: string;
};

export type SkillDTO = { name: string; domain: string; level: string; abbreviation: string };

export type EvaluationDTO = {
  id: string;
  name: string;
  subject: string;
  teacher: string;
  date: string;
  description: string;
  coefficient: number;
  skills: SkillDTO[];
};

export type UpcomingTestDTO = {
  id: string;
  subject: string;
  title?: string;
  from: string;
  to?: string;
  room?: string;
  color?: string;
};

export type UpcomingTestsDTO = { tests: UpcomingTestDTO[]; raw?: string };

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
  survey: boolean;
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

export type SurveyQuestionKind = "text" | "single" | "multiple" | "info";

export type SurveyQuestionDTO = {
  id: string;
  kind: SurveyQuestionKind;
  label: string;
  title: string;
  content: string;
  choices: { position: number; label: string; free: boolean }[];
  maxChoices: number | null;
  maxLength: number | null;
  answered: boolean;
  selected: number[];
  text: string;
  attachments: AttachmentDTO[];
};

export type SurveyDTO = {
  anonymous: boolean;
  open: boolean;
  endDate: string | null;
  questions: SurveyQuestionDTO[];
};

export type SurveyAnswer = { id: string; index: number; selected: number[]; text: string };

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

export type ReportFileDTO = {
  key: string;
  kind: string;
  year: number;
  yearLabel: string;
  className: string;
  period: string;
  periodStart?: string;
  fileName: string;
};

export type DocumentsDTO = { reports: ReportFileDTO[] };
