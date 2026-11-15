import { env } from "@notion-automation/env";
import { notion } from "./notion";
import {
  CONCURRENCY,
  findYearPageId,
  mapPool,
  relation,
  richText,
  title,
  type PageProperties,
} from "./notionHelpers";
import { buildPlan } from "./routineCalendar";

export class YearAlreadyExistsError extends Error {
  constructor(year: number) {
    super(`O ano ${year} já existe no database de anos.`);
    this.name = "YearAlreadyExistsError";
  }
}

export type CreateYearResult = {
  year: number;
  yearPageId: string;
  created: {
    years: number;
    quarters: number;
    months: number;
    weeks: number;
    days: number;
  };
};

export async function createYear(
  year: number,
  startToday = false,
): Promise<CreateYearResult> {
  const plan = buildPlan(year, startToday);

  if (await findYearPageId(plan.name)) {
    throw new YearAlreadyExistsError(year);
  }

  const createdPageIds: string[] = [];
  const createPage = async (databaseId: string, properties: PageProperties) => {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
    createdPageIds.push(page.id);
    return page.id;
  };

  try {
    // 1. Ano
    const yearId = await createPage(env.YEAR_TOKEN, { Name: title(plan.name) });

    // 2. Trimestres → Ano
    const quarterIds = await mapPool(plan.quarters, CONCURRENCY, (q) =>
      createPage(env.QUARTERLY_TOKEN, {
        Name: title(q.name),
        "Número do Trimestre": { number: q.number },
        Anos: relation(yearId),
      }),
    );

    // 3. Meses → Trimestre
    const monthIds = await mapPool(plan.months, CONCURRENCY, (m) =>
      createPage(env.MONTHLY_TOKEN, {
        Name: title(m.name),
        "Nº do mês": { number: m.number },
        Trimestres: relation(quarterIds[m.quarterIndex]!),
      }),
    );

    // 4. Semanas → Mês
    const weekIds = await mapPool(plan.weeks, CONCURRENCY, (w) =>
      createPage(env.WEEKLY_TOKEN, {
        Name: title(w.name),
        "Semana nº": { number: w.number },
        Data: richText(w.label),
        // monthIndex < 0: a semana começou num mês que não será criado (startToday)
        Meses: relation(monthIds[Math.max(w.monthIndex, 0)]!),
      }),
    );

    // 5. Dias → Semana
    await mapPool(plan.days, CONCURRENCY, (d) =>
      createPage(env.DAILY_TOKEN, {
        Name: title(d.name),
        "Dia Nº": { number: d.weekdayNumber },
        Data: { date: { start: d.date } },
        Semana: relation(weekIds[d.weekIndex]!),
      }),
    );

    return {
      year,
      yearPageId: yearId,
      created: {
        years: 1,
        quarters: plan.quarters.length,
        months: plan.months.length,
        weeks: plan.weeks.length,
        days: plan.days.length,
      },
    };
  } catch (error) {
    // Falhou no meio: manda para a lixeira o que já foi criado, para que o ano
    // possa ser gerado de novo sem deixar páginas órfãs/duplicadas.
    await mapPool(createdPageIds, CONCURRENCY, (id) =>
      notion.pages.update({ page_id: id, in_trash: true }).catch(() => null),
    );
    throw error;
  }
}
