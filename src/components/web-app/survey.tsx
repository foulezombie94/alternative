"use client";

import { Check } from "@getpapillon/papicons";
import { useState } from "react";
import type { NewsDTO, SurveyDTO, SurveyQuestionDTO } from "@/lib/pronote/types";
import { call, useApi } from "./api";
import { useWebApp } from "./context";
import { formatDay, formatTime } from "./format";
import { Async, Attachments, Html } from "./ui";

type Answer = { selected: number[]; text: string };
type Status = "idle" | "saving" | "saved" | "failed" | "nothing" | "unchanged";

const answerable = (question: SurveyQuestionDTO) => question.kind !== "info";

function initialAnswers(questions: SurveyQuestionDTO[]) {
  return Object.fromEntries(questions.map((question) => [question.id, { selected: question.selected, text: question.text }]));
}

function hasAnswer(question: SurveyQuestionDTO, answer: Answer | undefined) {
  if (!answer) return false;
  return question.kind === "text" ? answer.text.trim().length > 0 : answer.selected.length > 0;
}

function sameAnswer(a: Answer, b: Answer) {
  return a.text === b.text && a.selected.length === b.selected.length && a.selected.every((value) => b.selected.includes(value));
}

function Choices({
  question,
  answer,
  disabled,
  onChange,
}: {
  question: SurveyQuestionDTO;
  answer: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const { t } = useWebApp();
  const multiple = question.kind === "multiple";
  const full = multiple && question.maxChoices !== null && answer.selected.length >= question.maxChoices;
  const freeChosen = question.choices.some((choice) => choice.free && answer.selected.includes(choice.position));

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">{question.label}</legend>
      {multiple && (
        <p className="text-xs text-foreground/50">
          {question.maxChoices ? t.news.surveyMaxChoices.replace("{count}", String(question.maxChoices)) : t.news.surveyMultiple}
        </p>
      )}
      {question.choices.map((choice) => {
        const checked = answer.selected.includes(choice.position);
        return (
          <label
            key={choice.position}
            className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
              checked ? "border-primary bg-primary/5 font-medium" : "border-foreground/10 hover:border-foreground/30"
            } ${disabled || (full && !checked) ? "cursor-default opacity-60" : ""}`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={question.id}
              checked={checked}
              disabled={disabled || (full && !checked)}
              onChange={() => {
                const selected = multiple
                  ? checked
                    ? answer.selected.filter((value) => value !== choice.position)
                    : [...answer.selected, choice.position]
                  : [choice.position];
                onChange({ ...answer, selected });
              }}
              className="size-4 shrink-0 accent-primary"
            />
            <span>{choice.label}</span>
          </label>
        );
      })}
      {freeChosen && (
        <input
          type="text"
          value={answer.text}
          maxLength={question.maxLength ?? undefined}
          placeholder={t.news.surveyOther}
          onChange={(event) => onChange({ ...answer, text: event.target.value })}
          className="rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      )}
    </fieldset>
  );
}

function Question({
  question,
  answer,
  disabled,
  onChange,
}: {
  question: SurveyQuestionDTO;
  answer: Answer;
  disabled: boolean;
  onChange: (answer: Answer) => void;
}) {
  const { t } = useWebApp();

  if (!answerable(question)) {
    return (
      <div className="flex flex-col gap-3">
        {question.content && <Html html={question.content} className="text-foreground/80" />}
        <Attachments files={question.attachments} />
      </div>
    );
  }

  const done = hasAnswer(question, answer);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-foreground/10 bg-surface p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground/60">{question.title || question.label}</h3>
        {done && <Check className="size-4 text-primary" aria-hidden />}
      </header>
      {question.content && <Html html={question.content} className="font-medium" />}
      <Attachments files={question.attachments} />
      {question.kind === "text" ? (
        <textarea
          value={answer.text}
          disabled={disabled}
          rows={3}
          maxLength={question.maxLength ?? undefined}
          placeholder={t.news.surveyTextPlaceholder}
          onChange={(event) => onChange({ ...answer, text: event.target.value })}
          className="resize-y rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
        />
      ) : (
        <Choices question={question} answer={answer} disabled={disabled} onChange={onChange} />
      )}
    </section>
  );
}

function SurveyForm({ item, survey, onSaved }: { item: NewsDTO; survey: SurveyDTO; onSaved: () => void }) {
  const { t, locale } = useWebApp();
  const [initial, setInitial] = useState<Record<string, Answer>>(() => initialAnswers(survey.questions));
  const [sent, setSent] = useState<Set<string>>(() => new Set(survey.questions.filter((question) => question.answered).map((question) => question.id)));
  const [answers, setAnswers] = useState<Record<string, Answer>>(initial);
  const [status, setStatus] = useState<Status>("idle");

  const questions = survey.questions.filter(answerable);
  const done = questions.filter((question) => hasAnswer(question, answers[question.id])).length;
  const alreadyAnswered = sent.size > 0;
  const locked = !survey.open || status === "saving";

  const submit = async () => {
    const changed = survey.questions.flatMap((question, index) => {
      const answer = answers[question.id];
      if (!answerable(question) || !hasAnswer(question, answer)) return [];
      if (sent.has(question.id) && sameAnswer(answer, initial[question.id])) return [];
      return [{ id: question.id, index, selected: answer.selected, text: answer.text }];
    });
    if (changed.length === 0) {
      setStatus(done === 0 ? "nothing" : "unchanged");
      return;
    }
    setStatus("saving");
    try {
      const result = await call<{ saved: boolean }>("answerSurvey", {
        id: item.id,
        title: item.title,
        date: item.date,
        answers: changed,
      });
      setStatus(result.saved ? "saved" : "failed");
      if (result.saved) {
        setInitial((current) => ({ ...current, ...Object.fromEntries(changed.map((entry) => [entry.id, answers[entry.id]])) }));
        setSent((current) => new Set([...current, ...changed.map((entry) => entry.id)]));
        onSaved();
      }
    } catch {
      setStatus("failed");
    }
  };

  const message = {
    idle: null,
    saving: null,
    saved: { text: t.news.surveySaved, tone: "text-primary" },
    failed: { text: t.news.surveyFailed, tone: "text-accent" },
    nothing: { text: t.news.surveyNothing, tone: "text-foreground/60" },
    unchanged: { text: t.news.surveyUnchanged, tone: "text-foreground/60" },
  }[status];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
        {survey.anonymous && <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium">{t.news.surveyAnonymous}</span>}
        {survey.endDate && survey.open && (
          <span>
            {t.news.surveyOpenUntil.replace(
              "{date}",
              `${formatDay(survey.endDate, locale)} ${formatTime(survey.endDate, locale)}`,
            )}
          </span>
        )}
      </div>
      {!survey.open && <p className="rounded-md bg-foreground/5 px-3 py-2 text-sm text-foreground/70">{t.news.surveyClosed}</p>}
      {survey.questions.map((question) => (
        <Question
          key={question.id}
          question={question}
          answer={answers[question.id]}
          disabled={locked}
          onChange={(answer) => {
            setAnswers((current) => ({ ...current, [question.id]: answer }));
            if (status !== "saving") setStatus("idle");
          }}
        />
      ))}
      {survey.open && questions.length > 0 && (
        <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 border-t border-foreground/10 bg-surface px-1 pt-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-foreground/60">
              {t.news.surveyProgress.replace("{done}", String(done)).replace("{total}", String(questions.length))}
            </span>
            <button
              type="button"
              disabled={status === "saving"}
              onClick={submit}
              className="rounded-md bg-primary px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "saving" ? t.news.surveySending : alreadyAnswered ? t.news.surveyUpdate : t.news.surveySend}
            </button>
          </div>
          {message && (
            <p className={`flex items-center gap-2 text-sm ${message.tone}`} role="status">
              {status === "saved" && <Check className="size-4" />}
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Survey({ item, onAnswered }: { item: NewsDTO; onAnswered: () => void }) {
  const { t } = useWebApp();
  const state = useApi<SurveyDTO>("survey", { id: item.id, title: item.title, date: item.date });
  return (
    <Async state={state}>
        {(survey) =>
          survey.questions.length === 0 ? (
            <p className="text-sm text-foreground/60">{t.news.surveyLoadFailed}</p>
          ) : (
            <SurveyForm key={item.id} item={item} survey={survey} onSaved={onAnswered} />
          )
      }
    </Async>
  );
}
