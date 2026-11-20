import { env } from "@notion-automation/env";
import {
  findYearPageId,
  mapSequential,
  title,
} from "@/integrations/notion/helpers";
import { buildPlan, type PlanFrom } from "@/utils/routine-calendar";
import { YearAlreadyExistsError } from "./shared/errors";
import {
  createPage,
  dayProps,
  monthProps,
  prepareTemplates,
  quarterProps,
  trashPages,
  weekProps,
} from "./shared/year-pages";

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
  const tpl = await prepareTemplates(plan);

  const createdPageIds: string[] = [];
  const create = async (...args: Parameters<typeof createPage>) => {
    const id = await createPage(...args);
    createdPageIds.push(id);
    return id;
  };

  try {
    // 1. Ano (template padrão do database)
    const yearId = await create(env.YEAR_DATABASE_ID, {
      Name: title(plan.name),
    });

    // 2. Trimestres → Ano
    const quarterIds = await mapSequential(plan.quarters, (q) =>
      create(
        env.QUARTER_DATABASE_ID,
        quarterProps(q, yearId),
        tpl("quarter", q.name),
      ),
    );

    // 3. Meses → Trimestre
    const monthIds = await mapSequential(plan.months, (m) =>
      create(
        env.MONTH_DATABASE_ID,
        monthProps(m, quarterIds[m.quarterIndex]!),
        tpl("month", m.name),
      ),
    );

    // 4. Semanas → Mês
    // monthIndex < 0: a semana começou num mês que não será criado (recorte): liga ao 1º mês
    const weekIds = await mapSequential(plan.weeks, (w) =>
      create(
        env.WEEK_DATABASE_ID,
        weekProps(w, monthIds[Math.max(w.monthIndex, 0)]!),
        tpl("week", w.name),
      ),
    );

    // 5. Dias → Semana
    await mapSequential(plan.days, (d) =>
      create(
        env.DAY_DATABASE_ID,
        dayProps(d, weekIds[d.weekIndex]!),
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
    await trashPages(createdPageIds, { ignoreErrors: true });
    throw error;
  }
}
