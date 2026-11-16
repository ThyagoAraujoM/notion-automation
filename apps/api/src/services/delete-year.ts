import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "@/integrations/notion/client";
import {
  CONCURRENCY,
  findYearPageId,
  mapPool,
  queryAll,
} from "@/integrations/notion/helpers";
import { YearNotFoundError } from "./repair-year";

export type DeleteYearResult = {
  year: number;
  /** Páginas enviadas para a lixeira do Notion, por nível */
  deleted: {
    years: number;
    quarters: number;
    months: number;
    weeks: number;
    days: number;
  };
};

const uniqueById = (pages: PageObjectResponse[]) => [
  ...new Map(pages.map((p) => [p.id, p])).values(),
];

/**
 * Envia para a lixeira do Notion (recuperável) o ano e tudo que desce dele:
 * trimestres → meses → semanas → dias. Primeiro coleta toda a hierarquia e só então
 * apaga, dos dias para o ano, para não perder o caminho de descoberta no meio.
 * Idempotente: se falhar no meio, rodar de novo apaga o que sobrou (desde que o ano exista).
 */
export async function deleteYear(year: number): Promise<DeleteYearResult> {
  const yearId = await findYearPageId(String(year));
  if (!yearId) throw new YearNotFoundError(year);

  const quarters = await queryAll(env.QUARTERLY_TOKEN, {
    property: "Anos",
    relation: { contains: yearId },
  });
  const months = uniqueById(
    (
      await mapPool(quarters, CONCURRENCY, (q) =>
        queryAll(env.MONTHLY_TOKEN, {
          property: "Trimestres",
          relation: { contains: q.id },
        }),
      )
    ).flat(),
  );
  const weeks = uniqueById(
    (
      await mapPool(months, CONCURRENCY, (m) =>
        queryAll(env.WEEKLY_TOKEN, {
          property: "Meses",
          relation: { contains: m.id },
        }),
      )
    ).flat(),
  );
  const days = uniqueById(
    (
      await mapPool(weeks, CONCURRENCY, (w) =>
        queryAll(env.DAILY_TOKEN, {
          property: "Semana",
          relation: { contains: w.id },
        }),
      )
    ).flat(),
  );

  const trash = (pages: { id: string }[]) =>
    mapPool(pages, CONCURRENCY, (p) =>
      notion.pages.update({ page_id: p.id, in_trash: true }),
    );

  await trash(days);
  await trash(weeks);
  await trash(months);
  await trash(quarters);
  await trash([{ id: yearId }]);

  return {
    year,
    deleted: {
      years: 1,
      quarters: quarters.length,
      months: months.length,
      weeks: weeks.length,
      days: days.length,
    },
  };
}
