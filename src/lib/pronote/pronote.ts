import { randomUUID } from "node:crypto";
import {
  AccountKind,
  AssignmentReturnKind,
  assignmentStatus,
  assignmentsFromIntervals,
  cleanURL,
  clearPresenceInterval,
  createSessionHandle,
  type Discussion,
  discussionMessages,
  discussions,
  discussionSendMessage,
  EntityKind,
  finishLoginManually,
  type Food,
  type GradeValue,
  GradeKind,
  gradesOverview,
  loginCredentials,
  loginQrCode,
  loginToken,
  type Meal,
  menus,
  newDiscussion,
  type NewDiscussionRecipient,
  newDiscussionRecipients,
  news,
  type NewsInformation,
  type NewsSurvey,
  newsInformationAcknowledge,
  notebook,
  NotebookObservationKind,
  parseTimetable,
  type RefreshInformation,
  resource,
  SecurityError,
  securitySave,
  securitySource,
  SessionExpiredError,
  type SessionHandle,
  startPresenceInterval,
  TabLocation,
  timetableFromIntervals,
  type Attachment,
} from "@blockshub/pawnote-lts";
import { subjectAverage } from "./average";
import { pronoteFetcher } from "./fetcher";
import type { SchoolService } from "./service";
import {
  type AttachmentDTO,
  type CourseDTO,
  CourseKind,
  CourseState,
  type DishesDTO,
  type Feature,
  type PeriodsDTO,
  type Score,
} from "./types";

const securitySourceName = "Papillon Web";

const tabFeatures: Partial<Record<TabLocation, Feature>> = {
  [TabLocation.Timetable]: "timetable",
  [TabLocation.Assignments]: "homework",
  [TabLocation.Grades]: "grades",
  [TabLocation.Notebook]: "attendance",
  [TabLocation.News]: "news",
  [TabLocation.Discussions]: "chat",
  [TabLocation.Menus]: "canteen",
};

const canceledStatuses = new Set([
  "Cours annulé",
  "Prof. absent",
  "Classe absente",
  "Prof./pers. absent",
  "Sortie pédagogique",
]);

export class NotSupportedError extends Error {}

export type PendingChallenge = {
  handle: SessionHandle;
  error: SecurityError;
  deviceUUID: string;
};

export type LoginOutcome =
  | { status: "ok"; service: PronoteService }
  | { status: "pin"; challenge: PendingChallenge };

export type CredentialsInput = { url: string; username: string; password: string; parent: boolean };

export type PronoteCredentials = { refresh: RefreshInformation; deviceUUID: string };

export async function restorePronote({ refresh, deviceUUID }: PronoteCredentials): Promise<PronoteService> {
  const handle = createSessionHandle(pronoteFetcher);
  const next = await loginToken(handle, {
    url: refresh.url,
    kind: refresh.kind,
    username: refresh.username,
    token: refresh.token,
    navigatorIdentifier: refresh.navigatorIdentifier,
    deviceUUID,
  });
  return new PronoteService(handle, next, deviceUUID);
}

export type QrInput = { qr: { jeton: string; login: string; url: string }; pin: string };

export async function loginWithCredentials(input: CredentialsInput): Promise<LoginOutcome> {
  const deviceUUID = randomUUID();
  const handle = createSessionHandle(pronoteFetcher);

  return settleLogin(handle, deviceUUID, () =>
    loginCredentials(handle, {
      url: cleanURL(input.url),
      kind: input.parent ? AccountKind.PARENT : AccountKind.STUDENT,
      username: input.username,
      password: input.password,
      deviceUUID,
    }),
  );
}

export async function loginWithQrCode(input: QrInput): Promise<LoginOutcome> {
  const deviceUUID = randomUUID();
  const handle = createSessionHandle(pronoteFetcher);

  return settleLogin(handle, deviceUUID, () =>
    loginQrCode(handle, { qr: input.qr, pin: input.pin, deviceUUID }),
  );
}

export async function solveChallenge(challenge: PendingChallenge, pin: string): Promise<PronoteService> {
  const { handle, error, deviceUUID } = challenge;
  await securitySource(handle, securitySourceName);
  await securitySave(handle, error.handle, { pin, deviceName: securitySourceName });
  const context = error.handle.context;
  const refresh = await finishLoginManually(
    handle,
    context.authentication,
    context.identity,
    context.initialUsername,
  );
  return new PronoteService(handle, refresh, deviceUUID);
}

async function settleLogin(
  handle: SessionHandle,
  deviceUUID: string,
  login: () => Promise<RefreshInformation>,
): Promise<LoginOutcome> {
  try {
    const refresh = await login();
    return { status: "ok", service: new PronoteService(handle, refresh, deviceUUID) };
  } catch (error) {
    if (!(error instanceof SecurityError)) throw error;

    const security = error.handle;
    if (security.shouldCustomPassword || security.shouldCustomDoubleAuth) {
      throw new NotSupportedError("security");
    }

    if (security.shouldEnterPIN) {
      return { status: "pin", challenge: { handle, error, deviceUUID } };
    }

    await securitySource(handle, securitySourceName);
    await securitySave(handle, security, { deviceName: securitySourceName });
    const refresh = await finishLoginManually(
      handle,
      security.context.authentication,
      security.context.identity,
      security.context.initialUsername,
    );
    return { status: "ok", service: new PronoteService(handle, refresh, deviceUUID) };
  }
}

const iso = (date: Date) => date.toISOString();

function attachment(file: Attachment): AttachmentDTO {
  return { name: file.name, url: file.url };
}

function score(grade: GradeValue | undefined): Score {
  if (!grade) return { value: null };

  switch (grade.kind) {
    case GradeKind.Grade:
      return Number.isFinite(grade.points) ? { value: grade.points ?? null } : { value: null };
    case GradeKind.Absent:
      return { value: null, label: "Abs." };
    case GradeKind.AbsentZero:
      return { value: 0, label: "Abs." };
    case GradeKind.Exempted:
    case GradeKind.Unfit:
      return { value: null, label: "Disp." };
    case GradeKind.NotGraded:
      return { value: null, label: "N.Not." };
    case GradeKind.Unreturned:
      return { value: null, label: "N.Rendu" };
    case GradeKind.UnreturnedZero:
      return { value: 0, label: "N.Rendu" };
    default:
      return { value: null };
  }
}

function dishes(meal: Meal | undefined): DishesDTO | undefined {
  if (!meal) return undefined;
  const names = (foods: ReadonlyArray<Food> | undefined) => foods?.map((food) => food.name).filter(Boolean);
  return {
    entry: names(meal.entry),
    main: names(meal.main),
    side: names(meal.side),
    cheese: names(meal.fromage),
    dessert: names(meal.dessert),
    drink: names(meal.drink),
  };
}

function clampRange(handle: SessionHandle, from: Date, to: Date): [Date, Date] | null {
  const start = new Date(Math.max(from.getTime(), handle.instance.firstDate.getTime()));
  const end = new Date(Math.min(to.getTime(), handle.instance.lastDate.getTime()));
  return start <= end ? [start, end] : null;
}

const skippedKeys = new Set(["N", "L", "G", "_T", "titre", "auteur", "public", "categorie", "genreReponse"]);

function findText(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || typeof value !== "object") return "";
  let best = "";
  for (const [key, child] of Object.entries(value)) {
    if (skippedKeys.has(key) || key.startsWith("date")) continue;
    const found = typeof child === "string" ? child : findText(child, depth + 1);
    if (found.trim().length > best.trim().length) best = found;
  }
  return best;
}

function newsContent(item: NewsInformation | NewsSurvey) {
  const content =
    item.is === "information"
      ? item.content
      : item.questions
          .map((question) => question.content)
          .filter(Boolean)
          .join("<br>");
  if (content?.trim()) return content;
  return findText((item as unknown as { _raw?: unknown })._raw);
}

function splitName(name: string) {
  const [main, detail] = name.split("(");
  return { name: main.trim(), detail: detail?.replace(")", "").trim() || undefined };
}

export class PronoteService implements SchoolService {
  private relogin: Promise<void> | null = null;
  private discussionCache = new Map<string, Discussion>();
  private newsCache = new Map<string, NewsInformation>();
  private rawNews = new Map<string, unknown>();
  private recipientCache = new Map<string, NewDiscussionRecipient>();

  constructor(
    private handle: SessionHandle,
    private refresh: RefreshInformation,
    private deviceUUID: string,
  ) {
    startPresenceInterval(handle);
  }

  logout() {
    clearPresenceInterval(this.handle);
  }

  credentials(): PronoteCredentials {
    const { url, token, username, kind, navigatorIdentifier } = this.refresh;
    return { refresh: { url, token, username, kind, navigatorIdentifier }, deviceUUID: this.deviceUUID };
  }

  private async renew() {
    this.relogin ??= (async () => {
      clearPresenceInterval(this.handle);
      const handle = createSessionHandle(pronoteFetcher);
      this.refresh = await loginToken(handle, {
        url: this.refresh.url,
        kind: this.refresh.kind,
        username: this.refresh.username,
        token: this.refresh.token,
        navigatorIdentifier: this.refresh.navigatorIdentifier,
        deviceUUID: this.deviceUUID,
      });
      this.handle = handle;
      startPresenceInterval(handle);
    })().finally(() => {
      this.relogin = null;
    });
    return this.relogin;
  }

  private async run<T>(request: (handle: SessionHandle) => Promise<T>): Promise<T> {
    if (this.relogin) await this.relogin;
    try {
      return await request(this.handle);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error;
      await this.renew();
      return request(this.handle);
    }
  }

  private periods(location: TabLocation): PeriodsDTO {
    const tab = this.handle.userResource.tabs.get(location);
    if (!tab) return { periods: [] };
    return {
      periods: tab.periods.map((period) => ({
        id: period.id,
        name: period.name,
        start: iso(period.startDate),
        end: iso(period.endDate),
      })),
      defaultId: tab.defaultPeriod?.id,
    };
  }

  private period(location: TabLocation, id: string) {
    const tab = this.handle.userResource.tabs.get(location);
    const period = tab?.periods.find((candidate) => candidate.id === id) ?? tab?.defaultPeriod;
    if (!period) throw new NotSupportedError("period");
    return period;
  }

  async profile() {
    const user = this.handle.userResource;
    const available = new Set<Feature>();
    for (const tab of this.handle.user.authorizations.tabs) {
      const feature = tabFeatures[tab];
      if (feature) available.add(feature);
    }
    const name = user.name;
    const lastName = /[A-ZÀ-ÖØ-Þ]{2,}(?:[\s'-]+[A-ZÀ-ÖØ-Þ]{2,})*/.exec(name)?.[0] ?? "";
    return {
      name,
      firstName: name.replace(lastName, "").trim() || name,
      className: user.className,
      school: user.establishmentName,
      demo: false,
      features: [...available],
    };
  }

  timetable(from: Date, to: Date) {
    return this.run(async (handle) => {
      const range = clampRange(handle, from, to);
      if (!range) return [];
      const timetable = await timetableFromIntervals(handle, range[0], range[1]);
      parseTimetable(handle, timetable, {
        withSuperposedCanceledClasses: false,
        withCanceledClasses: true,
        withPlannedClasses: true,
      });

      return timetable.classes
        .map((course): CourseDTO => {
          const base = {
            id: course.id,
            from: iso(course.startDate),
            to: iso(course.endDate),
            color: course.backgroundColor,
            notes: course.notes,
          };

          if (course.is === "lesson") {
            const canceled = course.canceled || (course.status ? canceledStatuses.has(course.status) : false);
            return {
              ...base,
              kind: CourseKind.Lesson,
              subject: course.subject?.name ?? "",
              room: course.classrooms.join(", ") || undefined,
              teacher: course.teacherNames.join(", ") || undefined,
              group: course.groupNames.join(", ") || undefined,
              state: canceled
                ? CourseState.Canceled
                : course.test
                  ? CourseState.Test
                  : course.status
                    ? CourseState.Edited
                    : undefined,
              statusText: course.status,
              resourceId: course.lessonResourceID,
            };
          }

          if (course.is === "detention") {
            return {
              ...base,
              kind: CourseKind.Detention,
              subject: course.title ?? "",
              room: course.classrooms.join(", ") || undefined,
              teacher: course.teacherNames.join(", ") || undefined,
            };
          }

          return { ...base, kind: CourseKind.Activity, subject: course.title };
        })
        .sort((a, b) => a.from.localeCompare(b.from));
    });
  }

  courseResources(resourceId: string) {
    return this.run(async (handle) => {
      const lesson = await resource(handle, resourceId);
      return lesson.contents.map((content) => ({
        title: content.title,
        description: content.description,
        attachments: content.files.map(attachment),
      }));
    });
  }

  homeworks(from: Date, to: Date) {
    return this.run(async (handle) => {
      const range = clampRange(handle, from, to);
      if (!range) return [];
      const assignments = await assignmentsFromIntervals(handle, range[0], range[1]);
      return assignments
        .map((assignment) => ({
          id: assignment.id,
          subject: assignment.subject.name,
          content: assignment.description,
          dueDate: iso(assignment.deadline),
          done: assignment.done,
          color: assignment.backgroundColor,
          attachments: assignment.attachments.map(attachment),
          uploadRequired: assignment.return.kind === AssignmentReturnKind.FileUpload,
          minutes: assignment.length,
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    });
  }

  setHomeworkDone(id: string, done: boolean) {
    return this.run((handle) => assignmentStatus(handle, id, done));
  }

  async gradePeriods() {
    return this.periods(TabLocation.Grades);
  }

  grades(periodId: string) {
    return this.run(async (handle) => {
      const overview = await gradesOverview(handle, this.period(TabLocation.Grades, periodId));
      const grades = overview.grades.map((grade) => ({
        id: grade.id,
        description: grade.comment,
        date: iso(grade.date),
        coefficient: grade.coefficient,
        outOf: score(grade.outOf),
        value: score(grade.value),
        average: score(grade.average),
        min: score(grade.min),
        max: score(grade.max),
        bonus: grade.isBonus ?? false,
        optional: grade.isOptional ?? false,
        subjectFile: grade.subjectFile ? attachment(grade.subjectFile) : undefined,
        correctionFile: grade.correctionFile ? attachment(grade.correctionFile) : undefined,
      }));

      const subjects = overview.subjectsAverages.map((average) => {
        const subjectGrades = grades
          .filter((_, index) => overview.grades[index].subject.id === average.subject.id)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        const official = score(average.student);
        const computed = official.value === null ? subjectAverage(subjectGrades) : null;

        return {
          id: average.subject.id,
          name: average.subject.name,
          color: average.backgroundColor,
          average: computed !== null ? { value: computed } : official,
          classAverage: score(average.class_average),
          min: score(average.min),
          max: score(average.max),
          outOf: computed !== null ? { value: 20 } : score(average.outOf),
          grades: subjectGrades,
        };
      });

      return {
        overall: score(overview.overallAverage),
        classOverall: score(overview.classAverage),
        subjects,
      };
    });
  }

  async attendancePeriods() {
    return this.periods(TabLocation.Notebook);
  }

  attendance(periodId: string) {
    return this.run(async (handle) => {
      const book = await notebook(handle, this.period(TabLocation.Notebook, periodId));
      return {
        absences: book.absences.map((absence) => ({
          id: absence.id,
          from: iso(absence.startDate),
          to: iso(absence.endDate),
          reason: absence.reason,
          justified: absence.justified,
          minutes: absence.hoursMissed * 60 + absence.minutesMissed,
        })),
        delays: book.delays.map((delay) => ({
          id: delay.id,
          date: iso(delay.date),
          reason: delay.reason,
          justified: delay.justified,
          minutes: delay.minutes,
        })),
        punishments: book.punishments.map((punishment) => ({
          id: punishment.id,
          date: iso(punishment.dateGiven),
          nature: punishment.title,
          givenBy: punishment.giver,
          reason: punishment.reasons.join(", "),
          circumstances: punishment.circumstances,
          work: punishment.workToDo,
          minutes: punishment.durationMinutes,
          exclusion: punishment.exclusion,
        })),
        observations: book.observations.map((observation) => ({
          id: observation.id,
          date: iso(observation.date),
          name: observation.name,
          subject: observation.subject?.name,
          reason: observation.reason,
          positive: observation.kind === NotebookObservationKind.Encouragement,
        })),
      };
    });
  }

  news() {
    return this.run(async (handle) => {
      const feed = await news(handle);
      return feed.items
        .map((item) => {
          const information = item.is === "information" ? item : null;
          this.rawNews.set(item.id, (item as unknown as { _raw?: unknown })._raw);
          if (information) this.newsCache.set(item.id, information);
          return {
            id: item.id,
            title: item.title ?? "",
            author: item.author ?? "",
            category: item.category?.name ?? "",
            date: iso(item.creationDate ?? new Date()),
            content: newsContent(item),
            read: Boolean(item.read),
            needsAcknowledgement: Boolean(information?.needToAcknowledge),
            acknowledged: Boolean(information?.acknowledged),
            attachments: [
              ...(information?.attachments ?? []),
              ...(item.is === "survey" ? item.questions.flatMap((question) => question.attachments ?? []) : []),
            ].map(attachment),
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  async newsDebug(id: string) {
    if (!this.rawNews.has(id)) await this.news();
    const raw = this.rawNews.get(id);
    return {
      patched: raw !== undefined,
      raw: raw === undefined ? null : JSON.stringify(raw, null, 2).slice(0, 20000),
    };
  }

  async acknowledgeNews(id: string) {
    if (!this.newsCache.has(id)) await this.news();
    const item = this.newsCache.get(id);
    if (!item) throw new NotSupportedError("news");
    await this.run((handle) => newsInformationAcknowledge(handle, item, true));
  }

  chats() {
    return this.run(async (handle) => {
      const list = await discussions(handle);
      return list.items
        .map((chat) => {
          this.discussionCache.set(chat.participantsMessageID, chat);
          return {
            id: chat.participantsMessageID,
            subject: chat.subject,
            with: chat.recipientName ?? chat.creator ?? "",
            date: iso(chat.date),
            unread: chat.numberOfMessagesUnread,
            messages: chat.numberOfMessages,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  private async discussion(id: string) {
    if (!this.discussionCache.has(id)) await this.chats();
    const chat = this.discussionCache.get(id);
    if (!chat) throw new NotSupportedError("chat");
    return chat;
  }

  async chatMessages(id: string) {
    const chat = await this.discussion(id);
    return this.run(async (handle) => {
      const thread = await discussionMessages(handle, chat, true);
      const me = handle.user.name;
      return {
        canReply: Boolean(thread.sendAction),
        messages: thread.sents
          .map((message) => ({
            id: message.id,
            author: message.author?.name ?? me,
            mine: !message.author,
            date: iso(message.creationDate),
            content: message.content,
            attachments: message.files.map(attachment),
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }

  async sendMessage(id: string, content: string) {
    const chat = await this.discussion(id);
    await this.run((handle) => discussionSendMessage(handle, chat, content));
  }

  recipients() {
    return this.run(async (handle) => {
      const lists = await Promise.all(
        [EntityKind.Teacher, EntityKind.Personal].map((kind) => newDiscussionRecipients(handle, kind)),
      );
      return lists.flat().map((recipient) => {
        this.recipientCache.set(recipient.id, recipient);
        const { name, detail } = splitName(recipient.name);
        return {
          id: recipient.id,
          name,
          detail: recipient.subjects.map((subject) => subject.name).join(", ") || detail,
        };
      });
    });
  }

  async createChat(subject: string, content: string, recipientIds: string[]) {
    if (recipientIds.some((id) => !this.recipientCache.has(id))) await this.recipients();
    const recipients = recipientIds
      .map((id) => this.recipientCache.get(id))
      .filter((recipient): recipient is NewDiscussionRecipient => Boolean(recipient));
    if (!recipients.length) throw new NotSupportedError("recipients");
    await this.run((handle) => newDiscussion(handle, subject, content, recipients));
  }

  canteen(from: Date) {
    return this.run(async (handle) => {
      const week = await menus(handle, from);
      return (week.days ?? [])
        .map((day) => ({ date: iso(day.date), lunch: dishes(day.lunch), dinner: dishes(day.dinner) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    });
  }
}
