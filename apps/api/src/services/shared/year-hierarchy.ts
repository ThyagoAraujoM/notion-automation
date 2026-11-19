import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { CONCURRENCY, mapPool, queryAll } from "@/integrations/notion/helpers";
import { uniqueById } from "@/utils/notion-pages";

/** Páginas filhas (sem repetição) de um conjunto de pais, pela relação `property` do database filho. */
export async function queryChildrenOf(
  databaseId: string,
  property: string,
  parents: { id: string }[],
) {
  const pages = await mapPool(parents, CONCURRENCY, (parent) =>
    queryAll(databaseId, {
      property,
      relation: { contains: parent.id },
    }),
  );
  return uniqueById(pages.flat());
}

/** Tudo que desce de um ano no Notion (a página do ano não está incluída). */
export type YearHierarchy = {
  quarters: PageObjectResponse[];
  months: PageObjectResponse[];
  weeks: PageObjectResponse[];
  days: PageObjectResponse[];
};

/**
 * Coleta trimestres → meses → semanas → dias ligados ao ano, seguindo as relações
 * (cada nível é descoberto a partir do anterior).
 */
export async function collectYearHierarchy(
  yearId: string,
): Promise<YearHierarchy> {
  const quarters = await queryChildrenOf(env.QUARTERLY_TOKEN, "Anos", [
    { id: yearId },
  ]);
  const months = await queryChildrenOf(
    env.MONTHLY_TOKEN,
    "Trimestres",
    quarters,
  );
  const weeks = await queryChildrenOf(env.WEEKLY_TOKEN, "Meses", months);
  const days = await queryChildrenOf(env.DAILY_TOKEN, "Semana", weeks);
  return { quarters, months, weeks, days };
}
