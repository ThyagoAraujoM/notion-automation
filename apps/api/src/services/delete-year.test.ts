import { env } from "@notion-automation/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNotion, templatesFor } from "@/test-utils/fake-notion";
import { buildPlan } from "@/utils/routine-calendar";
import { createYear } from "./create-year";
import { deleteYear } from "./delete-year";
import { YearNotFoundError } from "./shared/errors";

// O getter adia o acesso ao `fakeNotion` até o primeiro uso (o vi.mock é içado acima dos imports).
vi.mock("@/integrations/notion/client", () => ({
  get notion() {
    return fakeNotion.client;
  },
}));

const FROM = "2090-12-20";
const plan = buildPlan(2090, FROM);

beforeEach(() => {
  fakeNotion.reset();
  fakeNotion.setTemplates(templatesFor(plan));
});

describe("deleteYear", () => {
  it("lança YearNotFoundError se o ano não existe", async () => {
    await expect(deleteYear(2090)).rejects.toBeInstanceOf(YearNotFoundError);
    expect(fakeNotion.trashed).toEqual([]);
  });

  it("manda para a lixeira dias → semanas → meses → trimestres → ano e devolve as contagens", async () => {
    await createYear(2090, FROM);

    const result = await deleteYear(2090);

    expect(result).toEqual({
      year: 2090,
      deleted: {
        years: 1,
        quarters: plan.quarters.length,
        months: plan.months.length,
        weeks: plan.weeks.length,
        days: plan.days.length,
      },
    });
    expect(fakeNotion.all().every((p) => p.in_trash)).toBe(true);

    // Ordem dos níveis na lixeira: nunca um pai antes dos seus filhos
    const order = [
      env.DAY_DATABASE_ID,
      env.WEEK_DATABASE_ID,
      env.MONTH_DATABASE_ID,
      env.QUARTER_DATABASE_ID,
      env.YEAR_DATABASE_ID,
    ];
    const levels = fakeNotion.trashed.map((id) =>
      order.indexOf(fakeNotion.all().find((p) => p.id === id)!.databaseId),
    );
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("não toca nas páginas de outro ano", async () => {
    await createYear(2090, FROM);
    const from2091 = "2091-12-20";
    fakeNotion.setTemplates(templatesFor(buildPlan(2091, from2091)));
    await createYear(2091, from2091);

    await deleteYear(2090);

    const alive = fakeNotion.all().filter((p) => !p.in_trash);
    expect(alive.length).toBeGreaterThan(0);
    const yearNames = alive
      .filter((p) => p.databaseId === env.YEAR_DATABASE_ID)
      .map(
        (p) =>
          (p.properties.Name as { title: { plain_text: string }[] }).title[0]!
            .plain_text,
      );
    expect(yearNames).toEqual(["2091"]);
  });
});
