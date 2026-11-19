// Utilitários puros (sem I/O) para trabalhar com listas de páginas do Notion.
import type { PageObjectResponse } from "@notionhq/client";

/** Ids do Notion podem vir com ou sem hífens; compare sempre normalizados. */
export const normId = (id: string) => id.replace(/-/g, "");

export const uniqueById = (pages: PageObjectResponse[]) => [
  ...new Map(pages.map((p) => [p.id, p])).values(),
];

/** Indexa as páginas por chave; se houver duplicatas, a primeira vence. */
export function indexBy<K>(
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

/** Número capturado pelo 1º grupo de `regex` no texto (ex.: `T2` → 2), ou `null`. */
export const matchNumber = (text: string, regex: RegExp) => {
  const m = regex.exec(text.trim());
  return m ? Number(m[1]) : null;
};
