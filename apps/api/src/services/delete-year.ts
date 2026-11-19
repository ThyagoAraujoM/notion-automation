import { findYearPageId } from "@/integrations/notion/helpers";
import { YearNotFoundError } from "./shared/errors";
import { collectYearHierarchy } from "./shared/year-hierarchy";
import { trashPages } from "./shared/year-pages";

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

/**
 * Envia para a lixeira do Notion (recuperável) o ano e tudo que desce dele:
 * trimestres → meses → semanas → dias. Primeiro coleta toda a hierarquia e só então
 * apaga, dos dias para o ano, para não perder o caminho de descoberta no meio.
 * Idempotente: se falhar no meio, rodar de novo apaga o que sobrou (desde que o ano exista).
 */
export async function deleteYear(year: number): Promise<DeleteYearResult> {
  const yearId = await findYearPageId(String(year));
  if (!yearId) throw new YearNotFoundError(year);

  const { quarters, months, weeks, days } = await collectYearHierarchy(yearId);

  const ids = (pages: { id: string }[]) => pages.map((p) => p.id);
  await trashPages(ids(days));
  await trashPages(ids(weeks));
  await trashPages(ids(months));
  await trashPages(ids(quarters));
  await trashPages([yearId]);

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
