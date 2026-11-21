// Notion falso em memória para testar os services sem rede. Implementa só o que os
// helpers e os services usam: databases.retrieve, dataSources.query/listTemplates e
// pages.create/update. Os testes fazem `vi.mock("@/integrations/notion/client")` e
// devolvem `fakeNotion.client`.
import { env } from "@notion-automation/env";
import type { YearPlan } from "@/utils/routine-calendar";

type Json = Record<string, unknown>;

export type FakePage = {
  object: "page";
  id: string;
  /** Database onde a página foi criada */
  databaseId: string;
  properties: Record<string, Json>;
  in_trash: boolean;
};

type TemplateNames = Record<string, string[]>;

/** Converte a propriedade do formato de escrita (`pages.create`) para o de leitura. */
function toReadProperty(value: Json): Json {
  if ("title" in value) {
    const parts = value.title as { text: { content: string } }[];
    return {
      type: "title",
      title: parts.map((p) => ({ plain_text: p.text.content })),
    };
  }
  if ("rich_text" in value) return { type: "rich_text", ...value };
  if ("number" in value) return { type: "number", ...value };
  if ("date" in value) return { type: "date", ...value };
  if ("relation" in value) return { type: "relation", ...value };
  return value;
}

/** Subconjunto dos filtros que o código usa (title equals, relation contains, date, and). */
function matches(page: FakePage, filter: Json | undefined): boolean {
  if (!filter) return true;
  if (Array.isArray(filter.and)) {
    return (filter.and as Json[]).every((f) => matches(page, f));
  }
  const prop = page.properties[filter.property as string];
  if (!prop) return false;
  if (filter.title) {
    const text = (prop.title as { plain_text: string }[])
      .map((t) => t.plain_text)
      .join("");
    return text === (filter.title as { equals: string }).equals;
  }
  if (filter.relation) {
    const ids = (prop.relation as { id: string }[]).map((r) => r.id);
    return ids.includes((filter.relation as { contains: string }).contains);
  }
  if (filter.date) {
    const start = (prop.date as { start: string } | null)?.start.slice(0, 10);
    if (!start) return false;
    const rule = filter.date as Record<string, string>;
    if (rule.on_or_after) return start >= rule.on_or_after;
    if (rule.on_or_before) return start <= rule.on_or_before;
  }
  throw new Error(
    `Filtro não suportado pelo Notion falso: ${JSON.stringify(filter)}`,
  );
}

export function createFakeNotion() {
  let pages: FakePage[] = [];
  let templates: TemplateNames = {};
  let nextId = 1;
  let createCalls = 0;
  let failOnCreate: { at: number; error: Error } | null = null;
  /** Ordem em que as páginas foram enviadas para a lixeira. */
  let trashed: string[] = [];

  const byDataSource = (dataSourceId: string) =>
    dataSourceId.replace(/^ds:/, "");

  const client = {
    databases: {
      retrieve: async ({ database_id }: { database_id: string }) => ({
        object: "database",
        id: database_id,
        data_sources: [{ id: `ds:${database_id}` }],
      }),
    },
    dataSources: {
      listTemplates: async ({
        data_source_id,
      }: {
        data_source_id: string;
      }) => ({
        templates: (templates[byDataSource(data_source_id)] ?? []).map(
          (name) => ({ id: `tpl:${name}`, name }),
        ),
        has_more: false,
        next_cursor: null,
      }),
      query: async ({
        data_source_id,
        filter,
      }: {
        data_source_id: string;
        filter?: Json;
      }) => ({
        results: pages.filter(
          (p) =>
            p.databaseId === byDataSource(data_source_id) &&
            !p.in_trash &&
            matches(p, filter),
        ),
        has_more: false,
        next_cursor: null,
      }),
    },
    pages: {
      create: async ({
        parent,
        properties,
      }: {
        parent: { database_id: string };
        properties: Record<string, Json>;
      }) => {
        createCalls++;
        if (failOnCreate && createCalls === failOnCreate.at) {
          throw failOnCreate.error;
        }
        const page = addPage(parent.database_id, properties);
        return { id: page.id };
      },
      update: async ({
        page_id,
        properties,
        in_trash,
      }: {
        page_id: string;
        properties?: Record<string, Json>;
        in_trash?: boolean;
      }) => {
        const page = pages.find((p) => p.id === page_id);
        if (!page) throw new Error(`Página inexistente: ${page_id}`);
        if (properties) {
          for (const [name, value] of Object.entries(properties)) {
            page.properties[name] = toReadProperty(value);
          }
        }
        if (in_trash) {
          page.in_trash = true;
          trashed.push(page_id);
        }
        return { id: page_id };
      },
    },
  };

  function addPage(databaseId: string, properties: Record<string, Json>) {
    const page: FakePage = {
      object: "page",
      id: `page-${nextId++}`,
      databaseId,
      properties: Object.fromEntries(
        Object.entries(properties).map(([k, v]) => [k, toReadProperty(v)]),
      ),
      in_trash: false,
    };
    pages.push(page);
    return page;
  }

  return {
    client,
    /** Páginas vivas (fora da lixeira) de um database. */
    live: (databaseId: string) =>
      pages.filter((p) => p.databaseId === databaseId && !p.in_trash),
    all: () => pages,
    get trashed() {
      return trashed;
    },
    get createCalls() {
      return createCalls;
    },
    /** Semeia uma página já existente (formato de escrita das propriedades). */
    seed: addPage,
    /** Define os templates existentes, por database (todos os databases não listados ficam sem). */
    setTemplates: (value: TemplateNames) => {
      templates = value;
    },
    /** Faz a n-ésima chamada a `pages.create` (contando desde o `reset`) falhar. */
    failCreateAt: (at: number, error: Error) => {
      failOnCreate = { at, error };
    },
    reset: () => {
      pages = [];
      templates = {};
      nextId = 1;
      createCalls = 0;
      failOnCreate = null;
      trashed = [];
    },
  };
}

export const fakeNotion = createFakeNotion();

/** Templates que o plano precisa, no formato de `setTemplates` (um template por nome de página). */
export function templatesFor(plan: YearPlan): TemplateNames {
  return {
    [env.QUARTER_DATABASE_ID]: plan.quarters.map((q) => q.name),
    [env.MONTH_DATABASE_ID]: plan.months.map((m) => m.name),
    [env.WEEK_DATABASE_ID]: plan.weeks.map((w) => w.name),
    [env.DAY_DATABASE_ID]: plan.days.map((d) => d.name),
  };
}
