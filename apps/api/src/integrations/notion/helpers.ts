import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "@/integrations/notion/client";

export type PageProperties = NonNullable<
  Parameters<typeof notion.pages.create>[0]["properties"]
>;
type QueryFilter = Parameters<typeof notion.dataSources.query>[0]["filter"];
type PageProps = PageObjectResponse["properties"];

// A API do Notion aceita ~3 req/s; o client já refaz tentativas em 429.
export const CONCURRENCY = 3;

export const title = (content: string) => ({ title: [{ text: { content } }] });
export const richText = (content: string) => ({
  rich_text: [{ text: { content } }],
});
export const relation = (id: string) => ({ relation: [{ id }] });

const dataSourceIds = new Map<string, string>();

export async function getDataSourceId(databaseId: string) {
  const cached = dataSourceIds.get(databaseId);
  if (cached) return cached;

  const db = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in db) || !db.data_sources[0]) {
    throw new Error(
      "O Notion retornou o database de forma parcial (sem data sources).",
    );
  }
  dataSourceIds.set(databaseId, db.data_sources[0].id);
  return db.data_sources[0].id;
}

export type TemplateLevel = "quarter" | "month" | "week" | "day";
/** Nome do template → id, por nível (o ano usa o template padrão do database). */
export type Templates = Record<TemplateLevel, Map<string, string>>;

/** Rótulo em português de cada nível, só para as mensagens (as chaves do código seguem em inglês). */
const TEMPLATE_LEVEL_LABEL: Record<TemplateLevel, string> = {
  quarter: "trimestre",
  month: "mês",
  week: "semana",
  day: "dia",
};

export class MissingTemplatesError extends Error {
  constructor(public readonly missing: Record<TemplateLevel, string[]>) {
    const detail = Object.entries(missing)
      .filter(([, names]) => names.length > 0)
      .map(
        ([level, names]) =>
          `${TEMPLATE_LEVEL_LABEL[level as TemplateLevel]}: ${names.join(", ")}`,
      )
      .join(" | ");
    super(`Templates não encontrados no Notion (${detail}).`);
    this.name = "MissingTemplatesError";
  }
}

/** Templates de um database como `nome → id` (percorre a paginação). */
async function listTemplates(databaseId: string) {
  const data_source_id = await getDataSourceId(databaseId);
  const byName = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.listTemplates({
      data_source_id,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const t of res.templates) byName.set(t.name, t.id);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return byName;
}

/**
 * Busca os templates dos databases de trimestre, mês, semana e dia e confirma que
 * todos os nomes em `needed` existem, antes de qualquer página ser criada.
 */
export async function loadTemplates(
  needed: Record<TemplateLevel, string[]>,
): Promise<Templates> {
  const [quarter, month, week, day] = await Promise.all([
    listTemplates(env.QUARTER_DATABASE_ID),
    listTemplates(env.MONTH_DATABASE_ID),
    listTemplates(env.WEEK_DATABASE_ID),
    listTemplates(env.DAY_DATABASE_ID),
  ]);
  const templates: Templates = { quarter, month, week, day };

  const missing = { quarter: [], month: [], week: [], day: [] } as Record<
    TemplateLevel,
    string[]
  >;
  for (const level of Object.keys(needed) as TemplateLevel[]) {
    missing[level] = [...new Set(needed[level])].filter(
      (name) => !templates[level].has(name),
    );
  }
  if (Object.values(missing).some((names) => names.length > 0)) {
    throw new MissingTemplatesError(missing);
  }
  return templates;
}

/** Valor do parâmetro `template` do `pages.create` (padrão do database ou um template). */
export type PageTemplate =
  | { type: "default" }
  | { type: "template_id"; template_id: string };

/** Template do nível com o nome da página; erro explícito se não existir. */
export function templateById(
  templates: Templates,
  level: TemplateLevel,
  name: string,
): PageTemplate {
  const template_id = templates[level].get(name);
  if (!template_id) {
    throw new MissingTemplatesError({
      quarter: [],
      month: [],
      week: [],
      day: [],
      [level]: [name],
    });
  }
  return { type: "template_id", template_id };
}

/** Id da página do ano com esse `Name`, ou `null` se não existir. */
export async function findYearPageId(name: string) {
  const res = await notion.dataSources.query({
    data_source_id: await getDataSourceId(env.YEAR_DATABASE_ID),
    filter: { property: "Name", title: { equals: name } },
    page_size: 1,
  });
  return res.results[0]?.id ?? null;
}

/** Todas as páginas de um database que batem com o filtro (percorre a paginação). */
export async function queryAll(databaseId: string, filter: QueryFilter) {
  const data_source_id = await getDataSourceId(databaseId);
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results) {
      if (r.object === "page" && "properties" in r) pages.push(r);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

export const numberProp = (props: PageProps, name: string) => {
  const p = props[name];
  return p?.type === "number" ? p.number : null;
};

export const titleProp = (props: PageProps, name: string) => {
  const p = props[name];
  return p?.type === "title" ? p.title.map((t) => t.plain_text).join("") : "";
};

export const dateProp = (props: PageProps, name: string) => {
  const p = props[name];
  return p?.type === "date" ? (p.date?.start.slice(0, 10) ?? null) : null;
};

export const relationIds = (props: PageProps, name: string) => {
  const p = props[name];
  return p?.type === "relation" ? p.relation.map((r) => r.id) : [];
};

/**
 * Executa `fn` um item por vez, na ordem. Usado para criar páginas: o Notion lista os
 * filhos na relação do pai na ordem de criação, e criar em paralelo com template +
 * relação fez páginas irem para a lixeira (ver docs/decisoes.md, 006).
 */
export async function mapSequential<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (const [i, item] of items.entries()) results.push(await fn(item, i));
  return results;
}

/** Executa `fn` sobre os itens com no máximo `limit` chamadas simultâneas, preservando a ordem. */
export async function mapPool<T, R>(
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
