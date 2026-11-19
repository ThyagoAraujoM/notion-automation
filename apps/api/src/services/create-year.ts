import { env } from "@notion-automation/env";
import { notion } from "@/integrations/notion/client";
import {
  CONCURRENCY,
  findYearPageId,
  loadTemplates,
  mapPool,
  mapSequential,
  type PageTemplate,
  relation,
  richText,
  templateById,
  title,
  type PageProperties,
  type TemplateLevel,
} from "@/integrations/notion/helpers";
import { buildPlan, type PlanFrom } from "@/utils/routine-calendar";

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
  from: PlanFrom = false,
): Promise<CreateYearResult> {
  const plan = buildPlan(year, from);

  if (await findYearPageId(plan.name)) {
    throw new YearAlreadyExistsError(year);
  }

  // Valida os templates antes de criar qualquer página (falha cedo, sem deixar lixo)
  const templates = await loadTemplates({
    quarter: plan.quarters.map((q) => q.name),
    month: plan.months.map((m) => m.name),
    week: plan.weeks.map((w) => w.name),
    day: plan.days.map((d) => d.name),
  });

  const createdPageIds: string[] = [];
  const createPage = async (
    databaseId: string,
    properties: PageProperties,
    // Ano: template padrão do database; demais níveis: template com o mesmo nome da página
    template: PageTemplate = { type: "default" },
  ) => {
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
      template,
    });
    createdPageIds.push(page.id);
    return page.id;
  };

  const tpl = (level: TemplateLevel, name: string) =>
    templateById(templates, level, name);

  try {
    // 1. Ano
    const yearId = await createPage(env.YEAR_TOKEN, { Name: title(plan.name) });

    // 2. Trimestres → Ano
    const quarterIds = await mapSequential(plan.quarters, (q) =>
      createPage(
        env.QUARTERLY_TOKEN,
        {
          Name: title(q.name),
          "Número do Trimestre": { number: q.number },
          Anos: relation(yearId),
        },
        tpl("quarter", q.name),
      ),
    );

    // 3. Meses → Trimestre
    const monthIds = await mapSequential(plan.months, (m) =>
      createPage(
        env.MONTHLY_TOKEN,
        {
          Name: title(m.name),
          "Nº do mês": { number: m.number },
          Trimestres: relation(quarterIds[m.quarterIndex]!),
        },
        tpl("month", m.name),
      ),
    );

    // 4. Semanas → Mês
    const weekIds = await mapSequential(plan.weeks, (w) =>
      createPage(
        env.WEEKLY_TOKEN,
        {
          Name: title(w.name),
          "Semana nº": { number: w.number },
          Data: richText(w.label),
          // monthIndex < 0: a semana começou num mês que não será criado (startToday)
          Meses: relation(monthIds[Math.max(w.monthIndex, 0)]!),
        },
        tpl("week", w.name),
      ),
    );

    // 5. Dias → Semana
    await mapSequential(plan.days, (d) =>
      createPage(
        env.DAILY_TOKEN,
        {
          Name: title(d.name),
          "Dia Nº": { number: d.weekdayNumber },
          Data: { date: { start: d.date } },
          Semana: relation(weekIds[d.weekIndex]!),
        },
        tpl("day", d.name),
      ),
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
