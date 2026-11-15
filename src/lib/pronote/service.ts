import type {
  AccountDTO,
  AttendanceDTO,
  ChatDTO,
  ChatThreadDTO,
  CourseDTO,
  CourseResourceDTO,
  EvaluationDTO,
  GradesDTO,
  HolidayDTO,
  LessonContentDTO,
  HomeworkDTO,
  NewsDTO,
  PeriodsDTO,
  DocumentsDTO,
  ReportCardDTO,
  UpcomingTestsDTO,
  ProfileDTO,
  RecipientDTO,
  SurveyAnswer,
  SurveyDTO,
} from "./types";

export interface SchoolService {
  profile(): Promise<ProfileDTO>;
  account(): Promise<AccountDTO>;
  timetable(from: Date, to: Date): Promise<CourseDTO[]>;
  holidays(): Promise<HolidayDTO[]>;
  upcomingTests(): Promise<UpcomingTestsDTO>;
  courseResources(resourceId: string): Promise<CourseResourceDTO[]>;
  homeworks(from: Date, to: Date): Promise<HomeworkDTO[]>;
  setHomeworkDone(id: string, done: boolean): Promise<void>;
  gradePeriods(): Promise<PeriodsDTO>;
  grades(periodId: string): Promise<GradesDTO>;
  lessonContents(from: Date, to: Date): Promise<LessonContentDTO[]>;
  reportCardPeriods(): Promise<PeriodsDTO>;
  reportCard(periodId: string): Promise<ReportCardDTO>;
  documents(): Promise<DocumentsDTO>;
  documentPdf(key: string): Promise<{ url: string }>;
  evaluationPeriods(): Promise<PeriodsDTO>;
  evaluations(periodId: string): Promise<EvaluationDTO[]>;
  attendancePeriods(): Promise<PeriodsDTO>;
  attendance(periodId: string): Promise<AttendanceDTO>;
  news(): Promise<NewsDTO[]>;
  acknowledgeNews(id: string, title?: string, date?: string): Promise<{ acknowledged: boolean }>;
  survey(id: string, title?: string, date?: string): Promise<SurveyDTO>;
  answerSurvey(id: string, title: string, date: string, answers: SurveyAnswer[]): Promise<{ saved: boolean }>;
  chats(): Promise<ChatDTO[]>;
  chatMessages(id: string): Promise<ChatThreadDTO>;
  sendMessage(id: string, content: string): Promise<void>;
  recipients(): Promise<RecipientDTO[]>;
  createChat(subject: string, content: string, recipientIds: string[]): Promise<void>;
  logout(): void;
}
