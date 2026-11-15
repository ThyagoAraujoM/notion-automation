import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./notion";
import {
  CONCURRENCY,
  dateProp,
  findYearPageId,
  mapPool,
  numberProp,
  queryAll,
  relation,
  relationIds,
  richText,
  title,
  titleProp,
  type PageProperties,
} from "./notionHelpers";
import { buildPlan, MONTH_NAMES } from "./routineCalendar";

export class YearNotFoundError extends Error {
  constructor(year: number) {
    super(
      `O ano ${year} não existe no database de anos. Crie-o antes (sem repair).`,
    );
    this.name = "YearNotFoundError";
  }
}

export type RepairYearResult = {
  year: number;
  yearPageId: string;
  /** Páginas que faltavam e foram criadas */
  created: { quarters: number; months: number; weeks: number; days: number };
  /** Páginas que existiam mas estavam ligadas ao pai errado e foram religadas */
  relinked: { months: number; weeks: number; days: number };
};

const normId = (id: string) => id.replace(/-/g, "");

const uniqueById = (pages: PageObjectResponse[]) => [
  ...new Map(pages.map((p) => [p.id, p])).values(),
];

/** Indexa as páginas por chave; se houver duplicatas, a primeira vence. */
function indexBy<K>(
  pages: PageObjectResponse[],
  key: (page: PageObjectResponse) => K | null,
) {
  const map = new Map<K, PageObjectResponse>();
  for (const page of pages) {
    const k = key(page);
    if (k !== null && !map.has(k)) map.set(k, page);
  }
  return map;
}

const matchNumber = (text: string, regex: RegExp) => {
  const m = regex.exec(text.trim());
  return m ? Number(m[1]) : null;
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
  startToday = false,
): Promise<RepairYearResult> {
  const plan = buildPlan(year, startToday);

  const yearId = await findYearPageId(plan.name);
  if (!yearId) throw new YearNotFoundError(year);

  const created = { quarters: 0, months: 0, weeks: 0, days: 0 };
  const relinked = { months: 0, weeks: 0, days: 0 };

  const createPage = async (databaseId: string, properties: PageProperties) =>
    (
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties,
      })
    ).id;

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
  const quarterPages = await queryAll(env.QUARTERLY_TOKEN, {
    property: "Anos",
    relation: { contains: yearId },
  });
  const quarterByNumber = indexBy(
    quarterPages,
    (p) =>
      numberProp(p.properties, "Número do Trimestre") ??
      matchNumber(titleProp(p.properties, "Name"), /^T(\d)$/i),
  );
  const quarterIds = await mapPool(plan.quarters, CONCURRENCY, async (q) => {
    const found = quarterByNumber.get(q.number);
    if (found) return found.id;
    created.quarters++;
    return createPage(env.QUARTERLY_TOKEN, {
      Name: title(q.name),
      "Número do Trimestre": { number: q.number },
      Anos: relation(yearId),
    });
  });

  // Meses: tudo que está sob os trimestres do ano
  const monthPages = uniqueById(
    (
      await mapPool(quarterPages, CONCURRENCY, (qp) =>
        queryAll(env.MONTHLY_TOKEN, {
          property: "Trimestres",
          relation: { contains: qp.id },
        }),
      )
    ).flat(),
  );
  const monthByNumber = indexBy(monthPages, (p) => {
    const byName = MONTH_NAMES.findIndex(
      (n) => n.toLowerCase() === titleProp(p.properties, "Name").toLowerCase(),
    );
    return (
      numberProp(p.properties, "Nº do mês") ?? (byName >= 0 ? byName + 1 : null)
    );
  });
  const monthIds = await mapPool(plan.months, CONCURRENCY, async (m) => {
    const parentId = quarterIds[m.quarterIndex]!;
    const found = monthByNumber.get(m.number);
    if (found) {
      await ensureParent(found, "Trimestres", parentId, "months");
      return found.id;
    }
    created.months++;
    return createPage(env.MONTHLY_TOKEN, {
      Name: title(m.name),
      "Nº do mês": { number: m.number },
      Trimestres: relation(parentId),
    });
  });

  // Semanas: tudo que está sob os meses do ano
  const weekPages = uniqueById(
    (
      await mapPool(monthPages, CONCURRENCY, (mp) =>
        queryAll(env.WEEKLY_TOKEN, {
          property: "Meses",
          relation: { contains: mp.id },
        }),
      )
    ).flat(),
  );
  const weekByNumber = indexBy(
    weekPages,
    (p) =>
      numberProp(p.properties, "Semana nº") ??
      matchNumber(titleProp(p.properties, "Name"), /^Semana (\d+)/i),
  );
  const weekIds = await mapPool(plan.weeks, CONCURRENCY, async (w) => {
    // monthIndex < 0 (startToday): o mês de origem da semana está fora do plano
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
    return createPage(env.WEEKLY_TOKEN, {
      Name: title(w.name),
      "Semana nº": { number: w.number },
      Data: richText(w.label),
      Meses: relation(parentId),
    });
  });

  // Dias: localizados pela Data (mesmo que estejam sem semana)
  const dayPages = await queryAll(env.DAILY_TOKEN, {
    and: [
      { property: "Data", date: { on_or_after: `${year}-01-01` } },
      { property: "Data", date: { on_or_before: `${year}-12-31` } },
    ],
  });
  const dayByDate = indexBy(dayPages, (p) => dateProp(p.properties, "Data"));
  await mapPool(plan.days, CONCURRENCY, async (d) => {
    const parentId = weekIds[d.weekIndex]!;
    const found = dayByDate.get(d.date);
    if (found) {
      await ensureParent(found, "Semana", parentId, "days");
      return;
    }
    created.days++;
    await createPage(env.DAILY_TOKEN, {
      Name: title(d.name),
      "Dia Nº": { number: d.weekdayNumber },
      Data: { date: { start: d.date } },
      Semana: relation(parentId),
    });
  });

  return { year, yearPageId: yearId, created, relinked };
}
