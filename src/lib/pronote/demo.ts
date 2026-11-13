import { subjectAverage, overallAverage } from "./average";
import type { SchoolService } from "./service";
import {
  type AttendanceDTO,
  type ChatDTO,
  type CourseDTO,
  CourseKind,
  CourseState,
  features,
  type GradesDTO,
  type HomeworkDTO,
  type MenuDayDTO,
  type MessageDTO,
  type NewsDTO,
  type PeriodDTO,
  type RecipientDTO,
} from "./types";

const lessons = [
  { subject: "Mathématiques", teacher: "Mme Lefèvre", room: "B 204", color: "#3568D4" },
  { subject: "Français", teacher: "M. Dubois", room: "A 112", color: "#D94B64" },
  { subject: "Histoire-Géographie", teacher: "Mme Bernard", room: "C 018", color: "#E29035" },
  { subject: "Anglais", teacher: "Mme Martin", room: "B 106", color: "#8E5AC7" },
  { subject: "Physique-Chimie", teacher: "M. Robert", room: "Labo 2", color: "#24A17A" },
  { subject: "Sciences de la vie et de la Terre", teacher: "Mme Moreau", room: "Labo 4", color: "#4A9B4F" },
  { subject: "Sciences économiques et sociales", teacher: "M. Petit", room: "C 202", color: "#B4772D" },
  { subject: "Éducation physique et sportive", teacher: "Mme Roux", room: "Gymnase", color: "#E05D34" },
];

const homeworkContent = [
  ["Mathématiques", "<p>Faire les exercices 42 à 47 page 128. Détailler les calculs dans le cahier.</p>"],
  ["Français", "<p>Lire les chapitres 6 et 7 de <em>Germinal</em> et préparer trois citations commentées.</p>"],
  ["Histoire-Géographie", "<p>Réviser le chapitre sur la Révolution française et compléter la frise chronologique.</p>"],
  ["Anglais", "<p>Apprendre le vocabulaire de la séquence « Living in London » et préparer l'expression orale.</p>"],
  ["Physique-Chimie", "<p>Rédiger le compte rendu du TP sur la réfraction de la lumière.</p>"],
  ["Sciences de la vie et de la Terre", "<p>Terminer le schéma légendé de la cellule et revoir la fiche méthode.</p>"],
] as const;

type Slot = { from: [number, number]; to: [number, number]; state?: CourseState; notes?: string; group?: string };

const daySlots: Slot[][] = [
  [
    { from: [8, 0], to: [10, 0] },
    { from: [10, 15], to: [11, 15] },
    { from: [12, 15], to: [14, 15] },
    { from: [14, 30], to: [15, 30], state: CourseState.Edited },
  ],
  [
    { from: [8, 0], to: [9, 0] },
    { from: [9, 15], to: [10, 15] },
    { from: [10, 30], to: [12, 30], state: CourseState.Test, notes: "Évaluation prévue" },
    { from: [14, 30], to: [16, 30] },
  ],
  [
    { from: [8, 0], to: [10, 0] },
    { from: [10, 15], to: [12, 15], state: CourseState.Canceled },
  ],
  [
    { from: [8, 0], to: [9, 0] },
    { from: [9, 15], to: [11, 15] },
    { from: [13, 15], to: [14, 15], state: CourseState.Canceled },
    { from: [14, 30], to: [16, 30] },
  ],
  [
    { from: [8, 0], to: [9, 0] },
    { from: [9, 15], to: [11, 15] },
    { from: [11, 30], to: [12, 30] },
    { from: [13, 30], to: [15, 30], state: CourseState.Edited },
  ],
];

const gradeSubjects = [
  ["Mathématiques", 15.5, 13.2, "#3568D4"],
  ["Français", 14, 12.8, "#D94B64"],
  ["Histoire-Géographie", 16, 13.7, "#E29035"],
  ["Anglais", 17.5, 14.1, "#8E5AC7"],
  ["Physique-Chimie", 13.5, 12.4, "#24A17A"],
  ["Sciences de la vie et de la Terre", 15, 13.5, "#4A9B4F"],
] as const;

const menuDishes = [
  { entry: ["Carottes râpées"], main: ["Poulet basquaise"], side: ["Riz pilaf"], dessert: ["Yaourt aux fruits"] },
  { entry: ["Salade de lentilles"], main: ["Lasagnes à la bolognaise"], side: ["Salade verte"], dessert: ["Pomme"] },
  { entry: ["Velouté de potiron"], main: ["Poisson pané"], side: ["Haricots verts"], cheese: ["Emmental"], dessert: ["Compote"] },
  { entry: ["Taboulé"], main: ["Chili sin carne"], side: ["Semoule"], dessert: ["Mousse au chocolat"] },
  { entry: ["Œuf mayonnaise"], main: ["Hachis parmentier"], side: ["Salade"], dessert: ["Tarte aux pommes"] },
];

const at = (day: Date, hours: number, minutes = 0) => {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const monday = (date: Date) => {
  const result = at(date, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};

const weekIndex = (date: Date) => Math.floor(monday(date).getTime() / (7 * 24 * 3600 * 1000));

const schoolYear = (date = new Date()) => (date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1);

function eachMonday(from: Date, to: Date) {
  const mondays: Date[] = [];
  for (let current = monday(from); current <= to; current = addDays(current, 7)) mondays.push(current);
  return mondays;
}

function demoHolidays() {
  const year = schoolYear();
  return [
    { name: "Armistice", start: new Date(year, 10, 11), end: new Date(year, 10, 11) },
    { name: "Vacances de Noël", start: new Date(year, 11, 19), end: new Date(year + 1, 0, 3) },
    { name: "Vacances d'hiver", start: new Date(year + 1, 1, 13), end: new Date(year + 1, 2, 1) },
    { name: "Lundi de Pâques", start: new Date(year + 1, 2, 29), end: new Date(year + 1, 2, 29) },
  ];
}

function isHoliday(day: Date) {
  const time = at(day, 0).getTime();
  return demoHolidays().some((holiday) => at(holiday.start, 0).getTime() <= time && time <= at(holiday.end, 0).getTime());
}

function periods(): PeriodDTO[] {
  const year = schoolYear();
  return [
    { id: "t1", name: "Trimestre 1", start: new Date(year, 8, 2).toISOString(), end: new Date(year, 11, 20).toISOString() },
    { id: "t2", name: "Trimestre 2", start: new Date(year + 1, 0, 6).toISOString(), end: new Date(year + 1, 2, 28).toISOString() },
    { id: "t3", name: "Trimestre 3", start: new Date(year + 1, 2, 31).toISOString(), end: new Date(year + 1, 6, 4).toISOString() },
  ];
}

function currentPeriodId() {
  const now = Date.now();
  return periods().find((period) => new Date(period.start).getTime() <= now && now <= new Date(period.end).getTime())?.id ?? "t1";
}

export class DemoService implements SchoolService {
  private doneHomework = new Map<string, boolean>();
  private acknowledged = new Set<string>();
  private sent = new Map<string, MessageDTO[]>();
  private created: ChatDTO[] = [];

  logout() {}

  async profile() {
    return {
      name: "MARTIN Camille",
      firstName: "Camille",
      className: "Seconde 2",
      school: "Lycée Papillon (démo)",
      demo: true,
      features: [...features],
    };
  }

  async holidays() {
    return demoHolidays().map((holiday) => ({
      name: holiday.name,
      start: holiday.start.toISOString(),
      end: holiday.end.toISOString(),
    }));
  }

  async timetable(from: Date, to: Date) {
    const courses: CourseDTO[] = [];
    for (const start of eachMonday(from, to)) {
      const week = weekIndex(start);
      daySlots.forEach((slots, dayIndex) => {
        const day = addDays(start, dayIndex);
        if (isHoliday(day)) return;
        slots.forEach((slot, slotIndex) => {
          const lesson = lessons[(dayIndex * 3 + slotIndex * 2 + week) % lessons.length];
          const begin = at(day, ...slot.from);
          if (begin < from || begin > to) return;
          courses.push({
            id: `demo-${week}-${dayIndex}-${slotIndex}`,
            kind: CourseKind.Lesson,
            subject: lesson.subject,
            teacher: lesson.teacher,
            room: lesson.room,
            color: lesson.color,
            group: slot.group,
            state: slot.state,
            statusText:
              slot.state === CourseState.Canceled
                ? "Prof. absent"
                : slot.state === CourseState.Edited
                  ? "Changement de salle"
                  : undefined,
            notes: slot.notes,
            from: begin.toISOString(),
            to: at(day, ...slot.to).toISOString(),
            resourceId: `demo-resource-${lesson.subject}`,
          });
        });
      });
    }
    return courses;
  }

  async courseResources(resourceId: string) {
    const subject = resourceId.replace("demo-resource-", "");
    return [
      {
        title: `${subject} : séance du jour`,
        description: "<p>Correction des exercices, puis introduction de la nouvelle notion avec une activité en binôme.</p>",
        attachments: [],
      },
    ];
  }

  async homeworks(from: Date, to: Date) {
    const list: HomeworkDTO[] = [];
    for (const start of eachMonday(from, to)) {
      const week = weekIndex(start);
      for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
        const due = at(addDays(start, dayIndex), 8);
        if (due < from || due > to || isHoliday(due)) continue;
        const [subject, content] = homeworkContent[(week + dayIndex) % homeworkContent.length];
        const id = `demo-homework-${week}-${dayIndex}`;
        list.push({
          id,
          subject,
          content,
          dueDate: due.toISOString(),
          done: this.doneHomework.get(id) ?? dayIndex === 0,
          color: lessons.find((lesson) => lesson.subject === subject)?.color,
          attachments: [],
          uploadRequired: dayIndex === 4,
          minutes: 30,
        });
      }
    }
    return list;
  }

  async setHomeworkDone(id: string, done: boolean) {
    this.doneHomework.set(id, done);
  }

  async gradePeriods() {
    return { periods: periods(), defaultId: currentPeriodId() };
  }

  async grades(periodId: string): Promise<GradesDTO> {
    const index = Number(periodId.slice(1)) || 1;
    const period = periods()[index - 1] ?? periods()[0];
    const start = new Date(period.start);
    const subjects = gradeSubjects.map(([name, average, classAverage, color], subjectIndex) => {
      const target = average - (index - 1) * 0.3;
      const grades = [0, 1, 2].map((gradeIndex) => ({
        id: `demo-grade-${index}-${subjectIndex}-${gradeIndex}`,
        description: ["Contrôle de connaissances", "Devoir maison", "Participation orale"][gradeIndex],
        date: addDays(start, 14 + subjectIndex * 5 + gradeIndex * 18).toISOString(),
        coefficient: gradeIndex === 0 ? 2 : 1,
        outOf: { value: 20 },
        value: { value: Math.max(8, target + gradeIndex - 1) },
        average: { value: classAverage },
        min: { value: 6.5 },
        max: { value: 19.5 },
        bonus: false,
        optional: false,
      }));
      return {
        id: `demo-subject-${subjectIndex}`,
        name,
        color,
        average: { value: subjectAverage(grades) },
        classAverage: { value: classAverage },
        min: { value: 7.5 },
        max: { value: 19 },
        outOf: { value: 20 },
        grades: grades.reverse(),
      };
    });

    return { overall: { value: overallAverage(subjects) }, classOverall: { value: 13.3 }, subjects };
  }

  async attendancePeriods() {
    return this.gradePeriods();
  }

  async attendance(): Promise<AttendanceDTO> {
    const year = schoolYear();
    return {
      delays: [
        { id: "demo-delay", date: new Date(year, 9, 7, 8, 12).toISOString(), reason: "Retard du bus", justified: true, minutes: 12 },
      ],
      absences: [
        {
          id: "demo-absence",
          from: new Date(year, 10, 18, 8).toISOString(),
          to: new Date(year, 10, 18, 12).toISOString(),
          reason: "Rendez-vous médical",
          justified: true,
          minutes: 240,
        },
      ],
      observations: [
        {
          id: "demo-observation",
          date: new Date(year, 9, 14, 11, 20).toISOString(),
          name: "Travail non fait",
          subject: "Français",
          reason: "Travail non présenté au début du cours.",
          positive: false,
        },
        {
          id: "demo-encouragement",
          date: new Date(year, 11, 2, 15, 30).toISOString(),
          name: "Encouragement",
          subject: "Histoire-Géographie",
          reason: "Exposé particulièrement clair et bien documenté.",
          positive: true,
        },
      ],
      punishments: [
        {
          id: "demo-punishment",
          date: new Date(year + 1, 0, 16, 16).toISOString(),
          nature: "Retenue",
          givenBy: "Mme Leroy, CPE",
          reason: "Usage du téléphone dans les couloirs.",
          circumstances: "Téléphone utilisé pendant un intercours malgré un premier rappel.",
          work: "Rédiger une réflexion sur le respect du règlement intérieur.",
          minutes: 60,
          exclusion: false,
        },
      ],
    };
  }

  async news(): Promise<NewsDTO[]> {
    const items = [
      ["Réunion parents-professeurs", "La direction", "Vie de l'établissement", "<p>La réunion parents-professeurs aura lieu jeudi à partir de 17 h 30. Le planning des salles sera affiché dans le hall.</p>"],
      ["Nouveautés au CDI", "Mme Garcia, professeure documentaliste", "CDI", "<p>Une sélection de romans contemporains et de bandes dessinées est disponible au CDI. Les élèves peuvent les emprunter pendant trois semaines.</p>"],
      ["Inscription à l'association sportive", "Service de la vie scolaire", "Vie scolaire", "<p>Les inscriptions à l'association sportive sont ouvertes jusqu'à vendredi. Une autorisation parentale est nécessaire.</p>"],
      ["Collecte solidaire", "Conseil de la vie lycéenne", "Projet citoyen", "<p>Le CVL organise une collecte de fournitures scolaires au profit d'une association locale.</p>"],
    ] as const;

    return items.map(([title, author, category, content], index) => {
      const id = `demo-news-${index}`;
      return {
        id,
        title,
        author,
        category,
        content,
        date: at(addDays(new Date(), -index * 3), 10, 15).toISOString(),
        read: index > 1,
        needsAcknowledgement: index === 0,
        acknowledged: this.acknowledged.has(id),
        attachments: [],
      };
    });
  }

  async acknowledgeNews(id: string) {
    this.acknowledged.add(id);
  }

  async chats(): Promise<ChatDTO[]> {
    const base: ChatDTO[] = [
      { id: "demo-chat-0", subject: "Sortie au musée", with: "Mme Bernard", date: addDays(new Date(), -1).toISOString(), unread: 1, messages: 2 },
      { id: "demo-chat-1", subject: "Exposé d'anglais", with: "Mme Martin", date: addDays(new Date(), -6).toISOString(), unread: 0, messages: 1 },
    ];
    return [...this.created, ...base].map((chat) => ({
      ...chat,
      messages: chat.messages + (this.sent.get(chat.id)?.length ?? 0),
    }));
  }

  async chatMessages(id: string) {
    const conversations: Record<string, MessageDTO[]> = {
      "demo-chat-0": [
        { id: "m0", author: "Mme Bernard", mine: false, date: addDays(new Date(), -2).toISOString(), content: "<p>Bonjour à tous, la sortie au musée aura lieu vendredi. Pensez à rapporter l'autorisation signée.</p>", attachments: [] },
        { id: "m1", author: "Mme Bernard", mine: false, date: addDays(new Date(), -1).toISOString(), content: "<p>Rendez-vous à 8 h devant le lycée.</p>", attachments: [] },
      ],
      "demo-chat-1": [
        { id: "m2", author: "Mme Martin", mine: false, date: addDays(new Date(), -6).toISOString(), content: "<p>Les groupes pour l'exposé sont affichés en salle B 106.</p>", attachments: [] },
      ],
    };
    return { canReply: true, messages: [...(conversations[id] ?? []), ...(this.sent.get(id) ?? [])] };
  }

  async sendMessage(id: string, content: string) {
    const messages = this.sent.get(id) ?? [];
    messages.push({
      id: `sent-${Date.now()}`,
      author: "MARTIN Camille",
      mine: true,
      date: new Date().toISOString(),
      content: `<p>${content.replace(/[<>&]/g, (char) => `&#${char.charCodeAt(0)};`)}</p>`,
      attachments: [],
    });
    this.sent.set(id, messages);
  }

  async recipients(): Promise<RecipientDTO[]> {
    return [
      ...lessons.map((lesson, index) => ({ id: `demo-teacher-${index}`, name: lesson.teacher, detail: lesson.subject })),
      { id: "demo-cpe", name: "Mme Leroy", detail: "CPE" },
    ];
  }

  async createChat(subject: string, content: string, recipientIds: string[]) {
    const recipients = await this.recipients();
    const id = `demo-chat-new-${Date.now()}`;
    this.created.unshift({
      id,
      subject,
      with: recipients.filter((recipient) => recipientIds.includes(recipient.id)).map((recipient) => recipient.name).join(", "),
      date: new Date().toISOString(),
      unread: 0,
      messages: 0,
    });
    await this.sendMessage(id, content);
  }

  async canteen(from: Date): Promise<MenuDayDTO[]> {
    const start = monday(from);
    return menuDishes.map((lunch, index) => ({ date: addDays(start, index).toISOString(), lunch }));
  }
}
