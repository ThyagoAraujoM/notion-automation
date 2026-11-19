// Peças comuns a createYear e repairYear: propriedades de cada nível, criação de página
// com template e envio para a lixeira.
import { notion } from "@/integrations/notion/client";
import {
  CONCURRENCY,
  loadTemplates,
  mapPool,
  relation,
  richText,
  templateById,
  title,
  type PageProperties,
  type PageTemplate,
  type TemplateLevel,
} from "@/integrations/notion/helpers";
import type {
  DayPlan,
  MonthPlan,
  QuarterPlan,
  WeekPlan,
  YearPlan,
} from "@/utils/routine-calendar";

export const quarterProps = (
  q: QuarterPlan,
  yearId: string,
): PageProperties => ({
  Name: title(q.name),
  "Número do Trimestre": { number: q.number },
  Anos: relation(yearId),
});

export const monthProps = (
  m: MonthPlan,
  quarterId: string,
): PageProperties => ({
  Name: title(m.name),
  "Nº do mês": { number: m.number },
  Trimestres: relation(quarterId),
});

export const weekProps = (w: WeekPlan, monthId: string): PageProperties => ({
  Name: title(w.name),
  "Semana nº": { number: w.number },
  Data: richText(w.label),
  Meses: relation(monthId),
});

export const dayProps = (d: DayPlan, weekId: string): PageProperties => ({
  Name: title(d.name),
  "Dia Nº": { number: d.weekdayNumber },
  Data: { date: { start: d.date } },
  Semana: relation(weekId),
});

/**
 * Busca os templates e valida que existem todos os que o plano usa (falha com
 * `MissingTemplatesError` antes de qualquer página ser criada). Devolve o seletor
 * `(nível, nome) → template` para passar ao `createPage`.
 */
export async function prepareTemplates(plan: YearPlan) {
  const templates = await loadTemplates({
    quarter: plan.quarters.map((q) => q.name),
    month: plan.months.map((m) => m.name),
    week: plan.weeks.map((w) => w.name),
    day: plan.days.map((d) => d.name),
  });
  return (level: TemplateLevel, name: string) =>
    templateById(templates, level, name);
}

/** Cria uma página no database e devolve o id. Sem `template`, usa o padrão do database (caso do ano). */
export async function createPage(
  databaseId: string,
  properties: PageProperties,
  template: PageTemplate = { type: "default" },
) {
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    template,
  });
  return page.id;
}

/** Envia páginas para a lixeira do Notion (recuperável). Com `ignoreErrors`, falhas individuais são ignoradas. */
export function trashPages(ids: string[], { ignoreErrors = false } = {}) {
  return mapPool(ids, CONCURRENCY, (id) => {
    const request = notion.pages.update({ page_id: id, in_trash: true });
    return ignoreErrors ? request.catch(() => null) : request;
  });
}
