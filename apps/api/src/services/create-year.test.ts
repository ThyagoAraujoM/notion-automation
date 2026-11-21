import { env } from "@notion-automation/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissingTemplatesError } from "@/integrations/notion/helpers";
import { fakeNotion, templatesFor } from "@/test-utils/fake-notion";
import { buildPlan } from "@/utils/routine-calendar";
import { createYear } from "./create-year";
import { YearAlreadyExistsError } from "./shared/errors";

// O getter adia o acesso ao `fakeNotion` até o primeiro uso (o vi.mock é içado acima dos imports).
vi.mock("@/integrations/notion/client", () => ({
  get notion() {
    return fakeNotion.client;
  },
}));

// Recorte pequeno (dez/2090) para o teste ficar rápido; a lógica é a mesma do ano inteiro.
const YEAR = 2090;
const FROM = "2090-12-20";
const plan = buildPlan(YEAR, FROM);

type Props = { properties: Record<string, unknown> };
const relationOf = (page: Props, name: string) =>
  (page.properties[name] as { relation: { id: string }[] }).relation.map(
    (r) => r.id,
  );
const nameOf = (page: Props) =>
  (page.properties.Name as { title: { plain_text: string }[] }).title[0]!
    .plain_text;

beforeEach(() => {
  fakeNotion.reset();
  fakeNotion.setTemplates(templatesFor(plan));
});

describe("createYear", () => {
  it("cria ano → trimestres → meses → semanas → dias e devolve as contagens", async () => {
    const result = await createYear(YEAR, FROM);

    expect(result.created).toEqual({
      years: 1,
      quarters: plan.quarters.length,
      months: plan.months.length,
      weeks: plan.weeks.length,
      days: plan.days.length,
    });
    expect(fakeNotion.live(env.YEAR_DATABASE_ID)).toHaveLength(1);
    expect(fakeNotion.live(env.DAY_DATABASE_ID)).toHaveLength(plan.days.length);
    expect(fakeNotion.trashed).toEqual([]);
  });

  it("liga cada página ao pai correto", async () => {
    const { yearPageId } = await createYear(YEAR, FROM);

    const quarters = fakeNotion.live(env.QUARTER_DATABASE_ID);
    const months = fakeNotion.live(env.MONTH_DATABASE_ID);
    const weeks = fakeNotion.live(env.WEEK_DATABASE_ID);
    const days = fakeNotion.live(env.DAY_DATABASE_ID);

    for (const q of quarters) {
      expect(relationOf(q, "Anos")).toEqual([yearPageId]);
    }
    // Dezembro é o único mês do recorte e fica sob o T4
    expect(months.map(nameOf)).toEqual(["Dezembro"]);
    const parentQuarter = quarters.find(
      (q) => q.id === relationOf(months[0]!, "Trimestres")[0],
    );
    expect(nameOf(parentQuarter!)).toBe("T4");
    // Toda semana (mesmo a que começou antes do recorte) fica ligada a um mês criado
    for (const w of weeks) {
      expect(months.map((m) => m.id)).toContain(relationOf(w, "Meses")[0]);
    }
    for (const d of days) {
      expect(weeks.map((w) => w.id)).toContain(relationOf(d, "Semana")[0]);
    }
  });

  it("lança YearAlreadyExistsError sem criar nada se o ano já existe", async () => {
    fakeNotion.seed(env.YEAR_DATABASE_ID, {
      Name: { title: [{ text: { content: String(YEAR) } }] },
    });

    await expect(createYear(YEAR, FROM)).rejects.toBeInstanceOf(
      YearAlreadyExistsError,
    );
    expect(fakeNotion.createCalls).toBe(0);
  });

  it("falha por template faltando antes de criar qualquer página", async () => {
    const templates = templatesFor(plan);
    templates[env.DAY_DATABASE_ID] = [];
    fakeNotion.setTemplates(templates);

    await expect(createYear(YEAR, FROM)).rejects.toBeInstanceOf(
      MissingTemplatesError,
    );
    expect(fakeNotion.createCalls).toBe(0);
  });

  it("se uma criação falha, manda para a lixeira o que já criou e propaga o erro", async () => {
    const boom = new Error("Notion fora do ar");
    // 1ª = ano, 2ª = T4, 3ª = Dezembro, 4ª = 1ª semana
    fakeNotion.failCreateAt(4, boom);

    await expect(createYear(YEAR, FROM)).rejects.toBe(boom);

    expect(fakeNotion.createCalls).toBe(4);
    expect(fakeNotion.trashed).toHaveLength(3);
    expect(fakeNotion.all().every((p) => p.in_trash)).toBe(true);
  });
});
