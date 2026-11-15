import type { GradeDTO } from "./types";

type Countable = Pick<GradeDTO, "value" | "outOf" | "coefficient" | "bonus" | "optional">;

export function subjectAverage(grades: Countable[], skipOptional = false): number | null {
  let points = 0;
  let total = 0;

  grades.forEach((grade, index) => {
    const value = grade.value.value;
    const outOf = grade.outOf.value;
    if (value === null || value < 0 || !outOf || grade.coefficient === 0) return;

    if (grade.optional && !skipOptional) {
      const without = subjectAverage(
        grades.filter((_, other) => other !== index),
        true,
      );
      const withIt = subjectAverage(grades, true);
      if (without !== null && withIt !== null && without > withIt) return;
    }

    if (grade.bonus) {
      const bonus = value - outOf / 2;
      if (bonus >= 0) {
        points += bonus;
        total += 1;
      }
      return;
    }

    const coefficient = grade.coefficient || 1;
    if (value > 20 || outOf > 20 || (coefficient < 1 && outOf - 20 >= -5)) {
      points += (value / outOf) * 20 * coefficient;
      total += 20 * coefficient;
    } else {
      points += value * coefficient;
      total += outOf * coefficient;
    }
  });

  if (total <= 0) return null;
  const result = Math.min((points / total) * 20, 20);
  return Number.isNaN(result) ? null : result;
}

export function overallAverage(subjects: { average: { value: number | null } }[]): number | null {
  const values = subjects.map((subject) => subject.average.value).filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function subjectsAverage(grades: (Countable & { subjectId: string })[]): number | null {
  const groups = new Map<string, Countable[]>();
  for (const grade of grades) groups.set(grade.subjectId, [...(groups.get(grade.subjectId) ?? []), grade]);
  const averages = [...groups.values()].map((group) => subjectAverage(group)).filter((value) => value !== null);
  if (!averages.length) return null;
  return averages.reduce((sum, value) => sum + value, 0) / averages.length;
}

export function averageHistory<T extends Countable & { subjectId: string; date?: string }>(grades: T[]) {
  const sorted = [...grades].sort(
    (a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0),
  );
  const points: { value: number; grade: T }[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const value = subjectsAverage(sorted.slice(0, index + 1));
    if (value !== null) points.push({ value, grade: sorted[index] });
  }
  return points;
}
