import type {
  AccountDTO,
  AttendanceDTO,
  ChatDTO,
  ChatThreadDTO,
  CourseDTO,
  CourseResourceDTO,
  GradesDTO,
  HolidayDTO,
  HomeworkDTO,
  NewsDTO,
  PeriodsDTO,
  ProfileDTO,
  RecipientDTO,
} from "./types";

export interface SchoolService {
  profile(): Promise<ProfileDTO>;
  account(): Promise<AccountDTO>;
  timetable(from: Date, to: Date): Promise<CourseDTO[]>;
  holidays(): Promise<HolidayDTO[]>;
  courseResources(resourceId: string): Promise<CourseResourceDTO[]>;
  homeworks(from: Date, to: Date): Promise<HomeworkDTO[]>;
  setHomeworkDone(id: string, done: boolean): Promise<void>;
  gradePeriods(): Promise<PeriodsDTO>;
  grades(periodId: string): Promise<GradesDTO>;
  attendancePeriods(): Promise<PeriodsDTO>;
  attendance(periodId: string): Promise<AttendanceDTO>;
  news(): Promise<NewsDTO[]>;
  acknowledgeNews(id: string): Promise<void>;
  chats(): Promise<ChatDTO[]>;
  chatMessages(id: string): Promise<ChatThreadDTO>;
  sendMessage(id: string, content: string): Promise<void>;
  recipients(): Promise<RecipientDTO[]>;
  createChat(subject: string, content: string, recipientIds: string[]): Promise<void>;
  logout(): void;
}
