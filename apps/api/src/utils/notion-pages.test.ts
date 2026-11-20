import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, it } from "vitest";
import { indexBy, matchNumber, normId, uniqueById } from "./notion-pages";

/** Página mínima: só o que estas funções leem. */
const page = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, ...extra }) as unknown as PageObjectResponse;

describe("normId", () => {
  it("remove os hífens para comparar ids do Notion", () => {
    expect(normId("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "0123456789abcdef0123456789abcdef",
    );
    expect(normId("abc")).toBe("abc");
  });
});

describe("uniqueById", () => {
  it("remove páginas repetidas mantendo a ordem da primeira ocorrência", () => {
    const pages = [page("a"), page("b"), page("a"), page("c")];
    expect(uniqueById(pages).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("indexBy", () => {
  it("indexa pela chave e a primeira duplicata vence", () => {
    const pages = [
      page("p1", { n: 1 }),
      page("p2", { n: 2 }),
      page("p3", { n: 1 }),
    ];
    const map = indexBy(pages, (p) => (p as unknown as { n: number }).n);

    expect(map.get(1)?.id).toBe("p1");
    expect(map.get(2)?.id).toBe("p2");
    expect(map.size).toBe(2);
  });

  it("ignora páginas cuja chave é null", () => {
    const map = indexBy([page("a"), page("b")], (p) =>
      p.id === "a" ? null : p.id,
    );
    expect([...map.keys()]).toEqual(["b"]);
  });
});

describe("matchNumber", () => {
  it("devolve o número do 1º grupo da regex", () => {
    expect(matchNumber("T2", /^T(\d)$/i)).toBe(2);
    expect(matchNumber("  Semana 12  ", /^Semana (\d+)/i)).toBe(12);
  });

  it("devolve null quando não bate", () => {
    expect(matchNumber("Janeiro", /^T(\d)$/i)).toBeNull();
  });
});
