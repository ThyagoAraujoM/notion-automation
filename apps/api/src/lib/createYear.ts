import { env } from "@notion-automation/env";
import { notion } from "./notion";
import { buildYearPlan, trimPlanFrom } from "./routineCalendar";

type PageProperties = NonNullable<
  Parameters<typeof notion.pages.create>[0]["properties"]
>;

// A API do Notion aceita ~3 req/s; o client já refaz tentativas em 429.
const CONCURRENCY = 3;

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

const title = (content: string) => ({ title: [{ text: { content } }] });
const richText = (content: string) => ({
  rich_text: [{ text: { content } }],
});
const relation = (id: string) => ({ relation: [{ id }] });

async function getDataSourceId(databaseId: string) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources[0]) {
    throw new Error(
      "O Notion retornou o database de forma parcial (sem data sources).",
    );
  }
  return db.data_sources[0].id;
}

async function yearExists(name: string) {
  const res = await notion.dataSources.query({
    data_source_id: await getDataSourceId(env.YEAR_TOKEN),
    filter: { property: "Name", title: { equals: name } },
    page_size: 1,
  });
  return res.results.length > 0;
}

/** Executa `fn` sobre os itens com no máximo `limit` chamadas simultâneas, preservando a ordem. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export class InvalidStartTodayError extends Error {
  constructor(year: number) {
    super(
      `startToday só pode ser usado com o ano atual (recebido ${year}, atual ${new Date().getFullYear()}).`,
    );
    this.name = "InvalidStartTodayError";
  }
}

function todayIso() {
  const d = new Date(); // data local do servidor
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function createYear(
  year: number,
  startToday = false,
): Promise<CreateYearResult> {
  let plan = buildYearPlan(year);

  if (startToday) {
    if (year !== new Date().getFullYear()) {
      throw new InvalidStartTodayError(year);
    }
    plan = trimPlanFrom(plan, todayIso());
  }

  if (await yearExists(plan.name)) {
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
        Meses: relation(monthIds[w.monthIndex]!),
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
