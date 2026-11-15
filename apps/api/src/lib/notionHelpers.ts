import { env } from "@notion-automation/env";
import type { PageObjectResponse } from "@notionhq/client";
import { notion } from "./notion";

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

/** Id da página do ano com esse `Name`, ou `null` se não existir. */
export async function findYearPageId(name: string) {
  const res = await notion.dataSources.query({
    data_source_id: await getDataSourceId(env.YEAR_TOKEN),
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
