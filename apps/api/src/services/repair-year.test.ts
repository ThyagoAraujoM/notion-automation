import { env } from "@notion-automation/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNotion, templatesFor } from "@/test-utils/fake-notion";
import { buildPlan } from "@/utils/routine-calendar";
import { createYear } from "./create-year";
import { repairYear } from "./repair-year";
import { YearNotFoundError } from "./shared/errors";

// O getter adia o acesso ao `fakeNotion` até o primeiro uso (o vi.mock é içado acima dos imports).
vi.mock("@/integrations/notion/client", () => ({
  get notion() {
    return fakeNotion.client;
  },
}));

const YEAR = 2090;
const FROM = "2090-12-20";
const plan = buildPlan(YEAR, FROM);

const relationOf = (
  page: { properties: Record<string, unknown> },
  name: string,
) =>
  (page.properties[name] as { relation: { id: string }[] }).relation.map(
    (r) => r.id,
  );

beforeEach(() => {
  fakeNotion.reset();
  fakeNotion.setTemplates(templatesFor(plan));
});

describe("repairYear", () => {
  it("lança YearNotFoundError se o ano não existe", async () => {
    await expect(repairYear(YEAR, FROM)).rejects.toBeInstanceOf(
      YearNotFoundError,
    );
    expect(fakeNotion.createCalls).toBe(0);
  });

  it("não cria nem religa nada quando o ano está completo", async () => {
    await createYear(YEAR, FROM);
    const calls = fakeNotion.createCalls;

    const result = await repairYear(YEAR, FROM);

    expect(result.created).toEqual({
      quarters: 0,
      months: 0,
      weeks: 0,
      days: 0,
    });
    expect(result.relinked).toEqual({ months: 0, weeks: 0, days: 0 });
    expect(fakeNotion.createCalls).toBe(calls);
  });

  it("cria tudo que falta quando só existe a página do ano", async () => {
    const yearPage = fakeNotion.seed(env.YEAR_DATABASE_ID, {
      Name: { title: [{ text: { content: String(YEAR) } }] },
    });

    const result = await repairYear(YEAR, FROM);

    expect(result.yearPageId).toBe(yearPage.id);
    expect(result.created).toEqual({
      quarters: plan.quarters.length,
      months: plan.months.length,
      weeks: plan.weeks.length,
      days: plan.days.length,
    });
    expect(result.relinked).toEqual({ months: 0, weeks: 0, days: 0 });
    for (const q of fakeNotion.live(env.QUARTER_DATABASE_ID)) {
      expect(relationOf(q, "Anos")).toEqual([yearPage.id]);
    }
  });

  it("recria um dia que sumiu", async () => {
    await createYear(YEAR, FROM);
    const [day] = fakeNotion.live(env.DAY_DATABASE_ID);
    await fakeNotion.client.pages.update({ page_id: day!.id, in_trash: true });

    const result = await repairYear(YEAR, FROM);

    expect(result.created.days).toBe(1);
    expect(fakeNotion.live(env.DAY_DATABASE_ID)).toHaveLength(plan.days.length);
  });

  it("religa um dia que está ligado à semana errada", async () => {
    await createYear(YEAR, FROM);
    const weeks = fakeNotion.live(env.WEEK_DATABASE_ID);
    const day = fakeNotion.live(env.DAY_DATABASE_ID)[0]!;
    const correctWeek = relationOf(day, "Semana")[0]!;
    const wrongWeek = weeks.find((w) => w.id !== correctWeek)!;
    await fakeNotion.client.pages.update({
      page_id: day.id,
      properties: { Semana: { relation: [{ id: wrongWeek.id }] } },
    });

    const result = await repairYear(YEAR, FROM);

    expect(result.relinked.days).toBe(1);
    expect(result.created.days).toBe(0);
    expect(relationOf(day, "Semana")).toEqual([correctWeek]);
  });
});

describe("repairYear — religação de semanas e meses", () => {
  const wideFrom = "2090-09-25";
  const wide = buildPlan(YEAR, wideFrom);

  beforeEach(() => {
    fakeNotion.setTemplates(templatesFor(wide));
  });

  it("religa uma semana ligada ao mês errado", async () => {
    await createYear(YEAR, wideFrom);
    const months = fakeNotion.live(env.MONTH_DATABASE_ID);
    // 1ª semana cujo mês está dentro do recorte (monthIndex >= 0)
    const index = wide.weeks.findIndex((w) => w.monthIndex >= 0);
    const week = fakeNotion.live(env.WEEK_DATABASE_ID)[index]!;
    const correct = relationOf(week, "Meses")[0]!;
    const wrong = months.find((m) => m.id !== correct)!;
    await fakeNotion.client.pages.update({
      page_id: week.id,
      properties: { Meses: { relation: [{ id: wrong.id }] } },
    });

    const result = await repairYear(YEAR, wideFrom);

    expect(result.relinked).toEqual({ months: 0, weeks: 1, days: 0 });
    expect(relationOf(week, "Meses")).toEqual([correct]);
  });

  it("religa um mês ligado ao trimestre errado", async () => {
    await createYear(YEAR, wideFrom);
    const quarters = fakeNotion.live(env.QUARTER_DATABASE_ID);
    const month = fakeNotion.live(env.MONTH_DATABASE_ID)[0]!;
    const correct = relationOf(month, "Trimestres")[0]!;
    const wrong = quarters.find((q) => q.id !== correct)!;
    await fakeNotion.client.pages.update({
      page_id: month.id,
      properties: { Trimestres: { relation: [{ id: wrong.id }] } },
    });

    const result = await repairYear(YEAR, wideFrom);

    expect(result.relinked.months).toBe(1);
    expect(relationOf(month, "Trimestres")).toEqual([correct]);
  });
});
