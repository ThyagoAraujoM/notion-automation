import type { PageObjectResponse } from "@notionhq/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notion } from "./client";
import {
  dateProp,
  getDataSourceId,
  loadTemplates,
  mapPool,
  mapSequential,
  MissingTemplatesError,
  numberProp,
  relation,
  relationIds,
  richText,
  templateById,
  title,
  titleProp,
  type Templates,
} from "./helpers";

// Client do Notion falso: só o que loadTemplates usa.
vi.mock("./client", () => ({
  notion: {
    databases: { retrieve: vi.fn() },
    dataSources: { listTemplates: vi.fn() },
  },
}));

type Props = PageObjectResponse["properties"];
const props = (p: Record<string, unknown>) => p as unknown as Props;

describe("builders de propriedade", () => {
  it("monta title, rich_text e relation no formato do Notion", () => {
    expect(title("T1")).toEqual({ title: [{ text: { content: "T1" } }] });
    expect(richText("1 Jan ➝ 4 Jan")).toEqual({
      rich_text: [{ text: { content: "1 Jan ➝ 4 Jan" } }],
    });
    expect(relation("abc")).toEqual({ relation: [{ id: "abc" }] });
  });
});

describe("leitura de propriedades", () => {
  const p = props({
    Name: {
      type: "title",
      title: [{ plain_text: "Sema" }, { plain_text: "na 3" }],
    },
    "Semana nº": { type: "number", number: 3 },
    Data: { type: "date", date: { start: "2026-01-12T10:00:00.000Z" } },
    Vazia: { type: "date", date: null },
    Meses: { type: "relation", relation: [{ id: "m1" }, { id: "m2" }] },
  });

  it("numberProp lê número e devolve null se a propriedade não for número", () => {
    expect(numberProp(p, "Semana nº")).toBe(3);
    expect(numberProp(p, "Name")).toBeNull();
    expect(numberProp(p, "Inexistente")).toBeNull();
  });

  it("titleProp junta os pedaços do título", () => {
    expect(titleProp(p, "Name")).toBe("Semana 3");
    expect(titleProp(p, "Semana nº")).toBe("");
  });

  it("dateProp devolve só YYYY-MM-DD", () => {
    expect(dateProp(p, "Data")).toBe("2026-01-12");
    expect(dateProp(p, "Vazia")).toBeNull();
    expect(dateProp(p, "Name")).toBeNull();
  });

  it("relationIds lista os ids da relação", () => {
    expect(relationIds(p, "Meses")).toEqual(["m1", "m2"]);
    expect(relationIds(p, "Name")).toEqual([]);
  });
});

describe("templateById e MissingTemplatesError", () => {
  const templates: Templates = {
    quarter: new Map([["T1", "tpl-t1"]]),
    month: new Map(),
    week: new Map(),
    day: new Map(),
  };

  it("devolve o template do nível pelo nome", () => {
    expect(templateById(templates, "quarter", "T1")).toEqual({
      type: "template_id",
      template_id: "tpl-t1",
    });
  });

  it("lança MissingTemplatesError com o nível e o nome", () => {
    expect(() => templateById(templates, "week", "Semana 54")).toThrow(
      "Templates não encontrados no Notion (semana: Semana 54).",
    );
  });

  it("a mensagem lista só os níveis com nomes faltando", () => {
    const error = new MissingTemplatesError({
      quarter: [],
      month: ["Março"],
      week: ["Semana 53", "Semana 54"],
      day: [],
    });
    expect(error.message).toBe(
      "Templates não encontrados no Notion (mês: Março | semana: Semana 53, Semana 54).",
    );
  });
});

describe("loadTemplates", () => {
  /** Templates existentes por database (id do database → nomes). */
  const existing: Record<string, string[]> = {
    "quarter-db": ["T1", "T2", "T3", "T4"],
    "month-db": ["Janeiro", "Fevereiro"],
    "week-db": ["Semana 1"],
    "day-db": ["Domingo", "Segunda - Feira"],
  };

  beforeEach(() => {
    vi.mocked(notion.databases.retrieve).mockImplementation((async ({
      database_id,
    }: {
      database_id: string;
    }) => ({
      data_sources: [{ id: `ds:${database_id}` }],
    })) as never);
    // Duas páginas de resultado, para cobrir a paginação
    vi.mocked(notion.dataSources.listTemplates).mockImplementation((async ({
      data_source_id,
      start_cursor,
    }: {
      data_source_id: string;
      start_cursor?: string;
    }) => {
      const names = existing[data_source_id.replace("ds:", "")]!;
      const half = Math.ceil(names.length / 2);
      const slice = start_cursor ? names.slice(half) : names.slice(0, half);
      return {
        templates: slice.map((name) => ({ name, id: `tpl:${name}` })),
        has_more: !start_cursor && names.length > half,
        next_cursor: start_cursor ? null : "next",
      };
    }) as never);
  });

  // Ids de database exclusivos destes testes: o cache de data source é do módulo,
  // então não reaproveitamos ids usados em outros testes (independe da ordem).
  it("guarda o data source em cache: um retrieve por database", async () => {
    vi.mocked(notion.databases.retrieve).mockClear();

    expect(await getDataSourceId("cache-db")).toBe("ds:cache-db");
    expect(await getDataSourceId("cache-db")).toBe("ds:cache-db");

    expect(notion.databases.retrieve).toHaveBeenCalledOnce();
  });

  it("falha com mensagem clara se o Notion devolver o database sem data sources", async () => {
    vi.mocked(notion.databases.retrieve).mockResolvedValueOnce({
      object: "database",
      id: "parcial-db",
    } as never);

    await expect(getDataSourceId("parcial-db")).rejects.toThrow(
      "sem data sources",
    );
  });

  it("devolve nome → id por nível quando todos existem (percorrendo a paginação)", async () => {
    const templates = await loadTemplates({
      quarter: ["T1", "T4"],
      month: ["Fevereiro"],
      week: ["Semana 1"],
      day: ["Segunda - Feira", "Segunda - Feira"],
    });

    expect(templates.quarter.get("T4")).toBe("tpl:T4");
    expect(templates.month.get("Fevereiro")).toBe("tpl:Fevereiro");
    expect(templates.day.size).toBe(2);
  });

  it("lança MissingTemplatesError com todos os faltantes (sem repetir) antes de criar nada", async () => {
    const promise = loadTemplates({
      quarter: ["T1"],
      month: ["Março"],
      week: ["Semana 54", "Semana 54"],
      day: ["Domingo"],
    });

    await expect(promise).rejects.toBeInstanceOf(MissingTemplatesError);
    await expect(promise).rejects.toMatchObject({
      missing: { quarter: [], month: ["Março"], week: ["Semana 54"], day: [] },
    });
  });
});

describe("mapSequential", () => {
  it("executa um item por vez, na ordem, e preserva os resultados", async () => {
    const log: string[] = [];
    const result = await mapSequential([30, 10, 20], async (ms, i) => {
      log.push(`start ${i}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${i}`);
      return ms * 2;
    });

    expect(result).toEqual([60, 20, 40]);
    expect(log).toEqual([
      "start 0",
      "end 0",
      "start 1",
      "end 1",
      "start 2",
      "end 2",
    ]);
  });
});

describe("mapPool", () => {
  it("respeita o limite de chamadas simultâneas e preserva a ordem", async () => {
    let running = 0;
    let peak = 0;
    const items = [5, 1, 4, 2, 3, 1, 2];

    const result = await mapPool(items, 3, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i;
    });

    expect(result).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(peak).toBe(3);
  });

  it("propaga o erro de qualquer item", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("falhou o 2");
        return n;
      }),
    ).rejects.toThrow("falhou o 2");
  });

  it("lista vazia não chama a função", async () => {
    const fn = vi.fn();
    expect(await mapPool([], 3, fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
