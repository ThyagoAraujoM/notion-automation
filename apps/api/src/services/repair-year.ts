import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "@/integrations/notion/client";
import {
  dateProp,
  findYearPageId,
  mapSequential,
  numberProp,
  queryAll,
  relation,
  relationIds,
  titleProp,
} from "@/integrations/notion/helpers";
import { indexBy, matchNumber, normId } from "@/utils/notion-pages";
import {
  buildPlan,
  MONTH_NAMES,
  type PlanFrom,
} from "@/utils/routine-calendar";
import { YearNotFoundError } from "./shared/errors";
import { queryChildrenOf } from "./shared/year-hierarchy";
import {
  createPage,
  dayProps,
  monthProps,
  prepareTemplates,
  quarterProps,
  weekProps,
} from "./shared/year-pages";

export type RepairYearResult = {
  year: number;
  yearPageId: string;
  /** Páginas que faltavam e foram criadas */
  created: { quarters: number; months: number; weeks: number; days: number };
  /** Páginas que existiam mas estavam ligadas ao pai errado e foram religadas */
  relinked: { months: number; weeks: number; days: number };
};

/**
 * Confere o ano contra o calendário e completa o que falta: cria páginas ausentes e
 * liga cada uma ao pai correto; páginas existentes ligadas ao pai errado são religadas.
 * É idempotente: se falhar no meio, basta rodar de novo (por isso não há rollback).
 *
 * Só encontra páginas alcançáveis a partir do ano (trimestre → mês → semana), exceto os
 * dias, que são localizados pela `Data` — então semanas "soltas" (sem mês) seriam recriadas.
 */
export async function repairYear(
  year: number,
  from: PlanFrom = false,
): Promise<RepairYearResult> {
  const plan = buildPlan(year, from);

  const yearId = await findYearPageId(plan.name);
  if (!yearId) throw new YearNotFoundError(year);

  // Valida os templates antes de criar qualquer página (mesma regra do createYear)
  const tpl = await prepareTemplates(plan);

  const created = { quarters: 0, months: 0, weeks: 0, days: 0 };
  const relinked = { months: 0, weeks: 0, days: 0 };

  /** Garante que a página `found` aponte só para `parentId` em `property`. */
  const ensureParent = async (
    found: PageObjectResponse,
    property: string,
    parentId: string,
    counter: keyof typeof relinked,
  ) => {
    const ids = relationIds(found.properties, property).map(normId);
    if (ids.length === 1 && ids[0] === normId(parentId)) return;
    await notion.pages.update({
      page_id: found.id,
      properties: { [property]: relation(parentId) },
    });
    relinked[counter]++;
  };

  // Trimestres (já ligados ao ano pela própria consulta)
  const quarterPages = await queryAll(env.QUARTER_DATABASE_ID, {
    property: "Anos",
    relation: { contains: yearId },
  });
  const quarterByNumber = indexBy(
    quarterPages,
    (p) =>
      numberProp(p.properties, "Número do Trimestre") ??
      matchNumber(titleProp(p.properties, "Name"), /^T(\d)$/i),
  );
  const quarterIds = await mapSequential(plan.quarters, async (q) => {
    const found = quarterByNumber.get(q.number);
    if (found) return found.id;
    created.quarters++;
    return createPage(
      env.QUARTER_DATABASE_ID,
      quarterProps(q, yearId),
      tpl("quarter", q.name),
    );
  });

  // Meses: tudo que está sob os trimestres do ano
  const monthPages = await queryChildrenOf(
    env.MONTH_DATABASE_ID,
    "Trimestres",
    quarterPages,
  );
  const monthByNumber = indexBy(monthPages, (p) => {
    const byName = MONTH_NAMES.findIndex(
      (n) => n.toLowerCase() === titleProp(p.properties, "Name").toLowerCase(),
    );
    return (
      numberProp(p.properties, "Nº do mês") ?? (byName >= 0 ? byName + 1 : null)
    );
  });
  const monthIds = await mapSequential(plan.months, async (m) => {
    const parentId = quarterIds[m.quarterIndex]!;
    const found = monthByNumber.get(m.number);
    if (found) {
      await ensureParent(found, "Trimestres", parentId, "months");
      return found.id;
    }
    created.months++;
    return createPage(
      env.MONTH_DATABASE_ID,
      monthProps(m, parentId),
      tpl("month", m.name),
    );
  });

  // Semanas: tudo que está sob os meses do ano
  const weekPages = await queryChildrenOf(
    env.WEEK_DATABASE_ID,
    "Meses",
    monthPages,
  );
  const weekByNumber = indexBy(
    weekPages,
    (p) =>
      numberProp(p.properties, "Semana nº") ??
      matchNumber(titleProp(p.properties, "Name"), /^Semana (\d+)/i),
  );
  const weekIds = await mapSequential(plan.weeks, async (w) => {
    // monthIndex < 0 (recorte): o mês de origem da semana está fora do plano
    const parentId = monthIds[Math.max(w.monthIndex, 0)]!;
    const found = weekByNumber.get(w.number);
    if (found) {
      // Não religa se o mês correto está fora do escopo: o 1º mês do plano seria errado
      if (w.monthIndex >= 0) {
        await ensureParent(found, "Meses", parentId, "weeks");
      }
      return found.id;
    }
    created.weeks++;
    return createPage(
      env.WEEK_DATABASE_ID,
      weekProps(w, parentId),
      tpl("week", w.name),
    );
  });

  // Dias: localizados pela Data (mesmo que estejam sem semana)
  const dayPages = await queryAll(env.DAY_DATABASE_ID, {
    and: [
      { property: "Data", date: { on_or_after: `${year}-01-01` } },
      { property: "Data", date: { on_or_before: `${year}-12-31` } },
    ],
  });
  const dayByDate = indexBy(dayPages, (p) => dateProp(p.properties, "Data"));
  await mapSequential(plan.days, async (d) => {
    const parentId = weekIds[d.weekIndex]!;
    const found = dayByDate.get(d.date);
    if (found) {
      await ensureParent(found, "Semana", parentId, "days");
      return;
    }
    created.days++;
    await createPage(
      env.DAY_DATABASE_ID,
      dayProps(d, parentId),
      tpl("day", d.name),
    );
  });

  return { year, yearPageId: yearId, created, relinked };
}
