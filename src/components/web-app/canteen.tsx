"use client";

import { useMemo, useState } from "react";
import type { DishesDTO, MenuDayDTO } from "@/lib/pronote/types";
import { useApi } from "./api";
import { useWebApp } from "./context";
import { capitalize, formatDay, sameDay, startOfWeek } from "./format";
import { Async, PageHeader, WeekNav } from "./ui";

const courses = ["entry", "main", "side", "cheese", "dessert", "drink"] as const;

function Meal({ title, dishes }: { title: string; dishes: DishesDTO }) {
  const { t } = useWebApp();
  const filled = courses.filter((course) => dishes[course]?.length);
  if (!filled.length) return null;

  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="mb-3 text-sm font-semibold text-primary">{title}</p>
      <dl className="flex flex-col gap-2">
        {filled.map((course) => (
          <div key={course}>
            <dt className="text-xs font-medium tracking-wide text-foreground/40 uppercase">{t.canteen[course]}</dt>
            <dd>{dishes[course]?.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function WebAppCanteen() {
  const { t, locale } = useWebApp();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const params = useMemo(() => ({ from: week.toISOString() }), [week]);
  const state = useApi<MenuDayDTO[]>("canteen", params);

  return (
    <>
      <PageHeader title={t.nav.canteen}>
        <WeekNav week={week} onChange={setWeek} />
      </PageHeader>
      <Async
        state={state}
        empty={t.canteen.noMenu}
        isEmpty={(days) => !days.some((day) => day.lunch || day.dinner)}
      >
        {(days) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {days
              .filter((day) => day.lunch || day.dinner)
              .map((day) => {
                const today = sameDay(new Date(day.date), new Date());
                return (
                  <section key={day.date} className={`rounded-3xl p-4 ${today ? "bg-primary/10" : "bg-surface"}`}>
                    <h2 className={`mb-3 px-1 font-semibold ${today ? "text-primary" : ""}`}>
                      {capitalize(formatDay(day.date, locale))}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {day.lunch && <Meal title={t.canteen.lunch} dishes={day.lunch} />}
                      {day.dinner && <Meal title={t.canteen.dinner} dishes={day.dinner} />}
                    </div>
                  </section>
                );
              })}
          </div>
        )}
      </Async>
    </>
  );
}
