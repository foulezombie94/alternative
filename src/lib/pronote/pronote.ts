import { randomUUID } from "node:crypto";
import {
  account,
  AccountKind,
  AssignmentReturnKind,
  assignmentStatus,
  assignmentsFromIntervals,
  bulletinBIAPdf,
  casierRaw,
  cleanURL,
  clearPresenceInterval,
  createSessionHandle,
  type Discussion,
  discussionMessages,
  discussions,
  discussionSendMessage,
  evaluations,
  EntityKind,
  finishLoginManually,
  type GradeValue,
  GradeKind,
  gradebook,
  homepageRaw,
  gradesOverview,
  loginCredentials,
  loginQrCode,
  loginToken,
  newDiscussion,
  type NewDiscussionRecipient,
  newDiscussionRecipients,
  news,
  newsDetail,
  type NewsQuestion,
  type NewsInformation,
  type NewsSurvey,
  newsInformationAcknowledge,
  newsAcknowledgeExact,
  notebook,
  NotebookObservationKind,
  parseTimetable,
  type RefreshInformation,
  resource,
  resourcesFromIntervals,
  SecurityError,
  securitySave,
  securitySource,
  SessionExpiredError,
  type SessionHandle,
  startPresenceInterval,
  TabLocation,
  timetableFromIntervals,
  type Attachment,
} from "./vendor/pawnote";
import { subjectAverage } from "./average";
import { pronoteFetcher } from "./fetcher";
import type { SchoolService } from "./service";
import {
  type AttachmentDTO,
  type CourseDTO,
  CourseKind,
  CourseState,
  type Feature,
  type PeriodsDTO,
  type ReportFileDTO,
  type Score,
} from "./types";

const securitySourceName = "Alternative Web";

const tabFeatures: Partial<Record<TabLocation, Feature>> = {
  [TabLocation.Timetable]: "timetable",
  [TabLocation.Assignments]: "homework",
  [TabLocation.Grades]: "grades",
  [TabLocation.Notebook]: "attendance",
  [TabLocation.News]: "news",
  [TabLocation.Discussions]: "chat",
  [TabLocation.Resources]: "contents",
  [TabLocation.Gradebook]: "report",
  [TabLocation.Evaluations]: "evaluations",
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

function clampRange(handle: SessionHandle, from: Date, to: Date): [Date, Date] | null {
  const start = new Date(Math.max(from.getTime(), handle.instance.firstDate.getTime()));
  const end = new Date(Math.min(to.getTime(), handle.instance.lastDate.getTime()));
  return start <= end ? [start, end] : null;
}

function newsContent(item: NewsInformation | NewsSurvey) {
  const content =
    item.is === "information"
      ? item.content
      : item.questions
          .map((question) => question.content)
          .filter(Boolean)
          .join("<br>");
  return content?.trim() ? content : "";
}

type Raw = Record<string, unknown>;

function unwrap(value: unknown): unknown {
  return value && typeof value === "object" && !Array.isArray(value) && "V" in value ? (value as Raw).V : value;
}

function rawText(value: unknown): string | undefined {
  const inner = unwrap(value);
  if (typeof inner === "string") return inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
  if (inner && typeof inner === "object" && typeof (inner as Raw).L === "string") return (inner as Raw).L as string;
  return undefined;
}

function rawDate(value: unknown): Date | undefined {
  const inner = unwrap(value);
  if (typeof inner !== "string") return undefined;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(inner);
  if (!match) return undefined;
  const [, day, month, year, hours = "0", minutes = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
}

function pick(entry: Raw, keys: string[]) {
  const found = Object.keys(entry).find((key) => keys.includes(key.toLowerCase()));
  return found ? entry[found] : undefined;
}

function findTestList(homepage: Raw): Raw[] | undefined {
  const key = Object.keys(homepage).find((name) => /^(ds|listeds|devoirssurveilles|prochainsds)$/i.test(name));
  if (!key) return undefined;
  let value = unwrap(homepage[key]);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const inner = Object.values(value as Raw).map(unwrap).find(Array.isArray);
    value = inner;
  }
  return Array.isArray(value) ? (value as Raw[]) : undefined;
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
        id: period.name,
        name: period.name,
        start: iso(period.startDate),
        end: iso(period.endDate),
      })),
      defaultId: tab.defaultPeriod?.name,
    };
  }

  private period(location: TabLocation, id: string) {
    const tab = this.handle.userResource.tabs.get(location);
    const period = tab?.periods.find((candidate) => candidate.name === id || candidate.id === id);
    if (!period) throw new NotSupportedError("period");
    return period;
  }

  async profile() {
    const user = this.handle.userResource;
    const available = new Set<Feature>();
    for (const tab of this.handle.user.authorizations.tabs) {
      const feature = tabFeatures[tab];
      if (feature) available.add(feature);
      if ((tab as number) === 148) available.add("documents");
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

  account() {
    return this.run(async (handle) => {
      const user = handle.userResource;
      const base = {
        name: user.name,
        className: user.className,
        school: user.establishmentName,
        delegate: user.isDelegate,
      };
      try {
        const details = await account(handle);
        const address = [...details.address, [details.postalCode, details.city].filter(Boolean).join(" "), details.country]
          .map((line) => line?.trim())
          .filter(Boolean)
          .join("\n");
        return {
          ...base,
          detailsAvailable: true,
          email: details.email || undefined,
          phone: details.phone || undefined,
          address: address || undefined,
          ine: details.INE || undefined,
        };
      } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
        return { ...base, detailsAvailable: false };
      }
    });
  }

  upcomingTests() {
    return this.run(async (handle) => {
      let raw: Raw | null = null;
      try {
        raw = await homepageRaw(handle);
      } catch (error) {
        if (error instanceof SessionExpiredError) throw error;
      }

      const now = Date.now();
      const fromHomepage = (raw ? (findTestList(raw) ?? []) : [])
        .map((entry, index) => {
          const from = rawDate(pick(entry, ["datedebut", "date", "debut", "datedebutcours"]));
          if (!from) return null;
          const to = rawDate(pick(entry, ["datefin", "fin"]));
          const subject = rawText(pick(entry, ["matiere", "service", "discipline"])) ?? rawText(entry.L) ?? "";
          const title = rawText(pick(entry, ["commentaire", "titre", "sujet", "description", "libelle", "l"]));
          return {
            id: typeof entry.N === "string" ? entry.N : `test-${index}`,
            subject,
            title: title && title !== subject ? title : undefined,
            from: iso(from),
            to: to ? iso(to) : undefined,
            room: rawText(pick(entry, ["salle", "salles", "lieu"])),
          };
        })
        .filter((test) => test !== null && new Date(test.from).getTime() >= now - 3600000)
        .map((test) => test!);

      if (fromHomepage.length) return { tests: fromHomepage.sort((a, b) => a.from.localeCompare(b.from)) };

      const start = new Date();
      const end = new Date(start.getTime() + 28 * 24 * 3600 * 1000);
      const courses = await this.timetable(start, end).catch(() => []);
      const tests = courses
        .filter((course) => course.state === CourseState.Test && new Date(course.to).getTime() >= now)
        .map((course) => ({
          id: course.id,
          subject: course.subject,
          from: course.from,
          to: course.to,
          room: course.room,
          color: course.color,
        }));

      const homepageTests = raw ? Object.fromEntries(Object.entries(raw).filter(([key]) => /ds|devoir/i.test(key))) : null;
      return {
        tests,
        raw: tests.length
          ? undefined
          : JSON.stringify({ keys: raw ? Object.keys(raw) : null, tests: homepageTests }, null, 2).slice(0, 12000),
      };
    });
  }

  async holidays() {
    return this.handle.instance.holidays.map((holiday) => ({
      name: holiday.name,
      start: iso(holiday.startDate),
      end: iso(holiday.endDate),
    }));
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

  lessonContents(from: Date, to: Date) {
    return this.run(async (handle) => {
      const range = clampRange(handle, from, to);
      if (!range) return [];
      const lessons = await resourcesFromIntervals(handle, range[0], range[1]);
      return lessons
        .filter((lesson) => lesson.contents.length > 0)
        .map((lesson) => ({
          id: lesson.id,
          subject: lesson.subject.name,
          color: lesson.backgroundColor,
          date: iso(lesson.startDate),
          teachers: lesson.teachers ?? [],
          contents: lesson.contents.map((content) => ({
            title: content.title,
            description: content.description,
            attachments: (content.files ?? []).map(attachment),
          })),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  async reportCardPeriods() {
    return this.periods(TabLocation.Gradebook);
  }

  private async reportFiles(handle: SessionHandle) {
    const raw = await casierRaw(handle);
    const box = raw.listeBulletinsBIA as { V?: unknown } | unknown[] | undefined;
    const list = (Array.isArray(box) ? box : Array.isArray(box?.V) ? box.V : []) as Record<string, unknown>[];
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    return list.map((entry) => {
      const start = entry.debutPeriodeNotation as { V?: string } | string | undefined;
      const day = typeof start === "string" ? start : start?.V;
      const [d, m, y] = (day ?? "").split(" ")[0].split("/").map(Number);
      const file: ReportFileDTO = {
        key: [entry.libelleAnnee, entry.libelleClasse, entry.libellePeriodeNotation, entry.libelle, entry.nomFichier].map(text).join("|"),
        kind: text(entry.libelle),
        year: typeof entry.annee === "number" ? entry.annee : Number(entry.annee) || 0,
        yearLabel: text(entry.libelleAnnee),
        className: text(entry.libelleClasse),
        period: text(entry.libellePeriodeNotation),
        periodStart: y ? new Date(Date.UTC(y, m - 1, d, 12)).toISOString() : undefined,
        fileName: text(entry.nomFichier),
      };
      return { file, entry };
    });
  }

  documents() {
    return this.run(async (handle) => ({ reports: (await this.reportFiles(handle)).map(({ file }) => file) }));
  }

  documentPdf(key: string) {
    return this.run(async (handle) => {
      const match = (await this.reportFiles(handle)).find(({ file }) => file.key === key);
      if (!match) throw new NotSupportedError("documents");
      return { url: await bulletinBIAPdf(handle, match.entry) };
    });
  }

  reportCard(periodId: string) {
    return this.run(async (handle) => {
      const report = await gradebook(handle, this.period(TabLocation.Gradebook, periodId));
      const number = (value: number | undefined): Score => ({
        value: typeof value === "number" && Number.isFinite(value) ? value : null,
      });
      return {
        message: report.message || undefined,
        subjects: (report.subjects ?? []).map((entry) => ({
          name: entry.subject.name,
          group: entry.subjectGroup || undefined,
          teachers: entry.teachers ?? [],
          coefficient: entry.coef,
          average: number(entry.averages?.student),
          classAverage: number(entry.averages?.classOverall),
          min: number(entry.averages?.min),
          max: number(entry.averages?.max),
          assessments: (entry.assessments ?? []).filter(Boolean),
        })),
        overall: (report.overallAssessments ?? []).filter((entry) => entry.value),
        raw:
          report.message || report.subjects?.length
            ? undefined
            : JSON.stringify((report as unknown as { _raw?: unknown })._raw ?? null, null, 2).slice(0, 20000),
      };
    });
  }

  async evaluationPeriods() {
    return this.periods(TabLocation.Evaluations);
  }

  evaluations(periodId: string) {
    return this.run(async (handle) => {
      const list = await evaluations(handle, this.period(TabLocation.Evaluations, periodId));
      return list
        .map((evaluation) => ({
          id: evaluation.id,
          name: evaluation.name,
          subject: evaluation.subject.name,
          teacher: evaluation.teacher,
          date: iso(evaluation.date),
          description: evaluation.description,
          coefficient: evaluation.coefficient,
          skills: (evaluation.skills ?? []).map((skill) => ({
            name: skill.itemName ?? skill.domainName,
            domain: skill.domainName,
            level: skill.level,
            abbreviation: skill.abbreviation,
          })),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    });
  }

  async attendancePeriods() {
    return this.periods(TabLocation.Notebook);
  }

  attendance(periodId: string) {
    return this.run(async (handle) => {
      const period = this.period(TabLocation.Notebook, periodId);
      const book = await notebook(handle, period);
      const start = new Date(period.startDate).setHours(0, 0, 0, 0);
      const end = new Date(period.endDate).setHours(23, 59, 59, 999);
      const inPeriod = (date: Date) => start <= date.getTime() && date.getTime() <= end;
      return {
        absences: book.absences.filter((absence) => inPeriod(absence.startDate)).map((absence) => ({
          id: absence.id,
          from: iso(absence.startDate),
          to: iso(absence.endDate),
          reason: absence.reason,
          justified: absence.justified,
          minutes: absence.hoursMissed * 60 + absence.minutesMissed,
        })),
        delays: book.delays.filter((delay) => inPeriod(delay.date)).map((delay) => ({
          id: delay.id,
          date: iso(delay.date),
          reason: delay.reason,
          justified: delay.justified,
          minutes: delay.minutes,
        })),
        punishments: book.punishments.filter((punishment) => inPeriod(punishment.dateGiven)).map((punishment) => ({
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
        observations: book.observations.filter((observation) => inPeriod(observation.date)).map((observation) => ({
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

  private async loadNews(handle: SessionHandle) {
    const feed = await news(handle);
    return feed.items
      .map((item) => {
        const information = item.is === "information" ? item : null;
        if (information) this.newsCache.set(item.id, information);
        this.rawNews.set(item.id, (item as unknown as { _raw?: unknown })._raw);
        return {
          id: item.id,
          title: item.title ?? "",
          author: item.author ?? "",
          category: item.category?.name ?? "",
          date: iso(item.creationDate ?? new Date()),
          content: newsContent(item),
          read: Boolean(item.read),
          survey: item.is === "survey",
          needsAcknowledgement: Boolean(information?.needToAcknowledge),
          acknowledged: Boolean(information?.acknowledged),
          attachments: [
            ...(information?.attachments ?? []),
            ...(item.is === "survey" ? item.questions.flatMap((question) => question.attachments ?? []) : []),
          ].map(attachment),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  news() {
    return this.run((handle) => this.loadNews(handle));
  }

  private async newsQuestions(handle: SessionHandle, id: string, title: string, date: string) {
    const fetchQuestions = async (refresh: boolean) => {
      let itemId = id;
      if (refresh || !this.rawNews.get(itemId)) {
        const list = await this.loadNews(handle);
        itemId =
          (
            list.find((entry) => entry.id === id) ??
            list.find((entry) => entry.title === title && entry.date === date) ??
            list.find((entry) => entry.title === title)
          )?.id ?? id;
      }
      const raw = this.rawNews.get(itemId);
      if (!raw) throw new NotSupportedError("news");
      return { itemId, raw, questions: await newsDetail(handle, raw) };
    };

    let result: { itemId: string; raw: unknown; questions: NewsQuestion[] };
    try {
      result = await fetchQuestions(false);
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      result = await fetchQuestions(true);
    }

    const { itemId, raw, questions } = result;
    const cached = this.newsCache.get(itemId);
    if (cached && questions[0]) {
      const question = questions[0];
      if (question.kind === undefined) (question as { kind: number }).kind = 0;
      (cached as unknown as { question: NewsQuestion }).question = question;
      const target = cached as unknown as { public?: { N?: string; G?: number } };
      if (!target.public?.G) {
        const source = raw as { public?: { V?: { N?: string; G?: number }; N?: string; G?: number }; genrePublic?: number };
        const audience = source.public?.V ?? source.public;
        target.public = { N: audience?.N, G: audience?.G ?? source.genrePublic ?? 4 };
      }
    }
    if (itemId !== id && cached) this.newsCache.set(id, cached);
    return { itemId, item: cached, questions };
  }

  newsDetail(id: string, title: string, date: string) {
    return this.run(async (handle) => {
      const { questions } = await this.newsQuestions(handle, id, title, date);
      return {
        content: questions.map((question) => question.content).filter((text) => text?.trim()).join("<br>"),
        attachments: questions.flatMap((question) => question.attachments ?? []).map(attachment),
        needsAcknowledgement: Boolean(questions[0]?.shouldAnswer),
        acknowledged: Boolean(questions[0]?.answered),
      };
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

  acknowledgeNews(id: string, title = "", date = "") {
    return this.run(async (handle) => {
      const { itemId, item, questions } = await this.newsQuestions(handle, id, title, date);
      const question = questions[0];
      if (!item || !question) throw new NotSupportedError("news");
      if (question.answered) return { acknowledged: true };
      if (!question.shouldAnswer) {
        await newsInformationAcknowledge(handle, item, true);
        return { acknowledged: false };
      }
      await newsAcknowledgeExact(handle, item);
      const check = await this.newsQuestions(handle, itemId, title, date);
      return { acknowledged: Boolean(check.questions[0]?.answered) };
    });
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
}
