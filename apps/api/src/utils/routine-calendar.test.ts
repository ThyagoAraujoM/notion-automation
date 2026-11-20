import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPlan,
  buildYearPlan,
  InvalidFromDateError,
  InvalidStartTodayError,
  MONTH_NAMES,
  trimPlanFrom,
  type YearPlan,
} from "./routine-calendar";

/** Dia da semana (0 = domingo) de uma data "YYYY-MM-DD", em UTC. */
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Invariantes que todo plano (inteiro ou recortado) precisa respeitar. */
function expectConsistent(plan: YearPlan) {
  for (const d of plan.days) {
    expect(plan.weeks[d.weekIndex], `semana do dia ${d.date}`).toBeDefined();
  }
  for (const m of plan.months) {
    expect(
      plan.quarters[m.quarterIndex],
      `trimestre de ${m.name}`,
    ).toBeDefined();
  }
  // Toda semana do plano tem pelo menos um dia
  plan.weeks.forEach((_, i) => {
    expect(plan.days.some((d) => d.weekIndex === i)).toBe(true);
  });
}

describe("buildYearPlan", () => {
  const plan = buildYearPlan(2026);

  it("nomeia o ano, os trimestres e os meses", () => {
    expect(plan.name).toBe("2026");
    expect(plan.quarters.map((q) => q.name)).toEqual(["T1", "T2", "T3", "T4"]);
    expect(plan.months.map((m) => m.name)).toEqual([...MONTH_NAMES]);
  });

  it("coloca 3 meses em cada trimestre", () => {
    expect(plan.months.map((m) => m.quarterIndex)).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3,
    ]);
    expect(plan.months.map((m) => m.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("cria um dia por data do ano, em ordem", () => {
    expect(plan.days).toHaveLength(365);
    expect(plan.days[0]!.date).toBe("2026-01-01");
    expect(plan.days.at(-1)!.date).toBe("2026-12-31");
  });

  it("usa os nomes de dia com ' - Feira' e Dia Nº com Domingo = 1", () => {
    // 1º/jan/2026 é quinta-feira
    expect(plan.days[0]).toMatchObject({
      name: "Quinta - Feira",
      weekdayNumber: 5,
    });
    const byDate = (date: string) => plan.days.find((d) => d.date === date)!;
    expect(byDate("2026-01-03")).toMatchObject({
      name: "Sábado",
      weekdayNumber: 7,
    });
    expect(byDate("2026-01-04")).toMatchObject({
      name: "Domingo",
      weekdayNumber: 1,
    });
    expect(byDate("2026-01-05")).toMatchObject({
      name: "Segunda - Feira",
      weekdayNumber: 2,
    });
  });

  it("corta a primeira e a última semana nos limites do ano (53 semanas em 2026)", () => {
    expect(plan.weeks).toHaveLength(53);
    expect(plan.weeks[0]).toMatchObject({
      name: "Semana 1",
      number: 1,
      label: "1 Jan ➝ 4 Jan",
      monthIndex: 0,
    });
    expect(plan.weeks[1]!.label).toBe("5 Jan ➝ 11 Jan");
    expect(plan.weeks.at(-1)).toMatchObject({
      name: "Semana 53",
      label: "28 Dez ➝ 31 Dez",
      monthIndex: 11,
    });
  });

  it("numera as semanas em sequência e abre toda semana (exceto a 1ª) na segunda", () => {
    plan.weeks.forEach((w, i) => expect(w.number).toBe(i + 1));
    for (let i = 1; i < plan.weeks.length; i++) {
      const firstDay = plan.days.find((d) => d.weekIndex === i)!;
      expect(weekdayOf(firstDay.date)).toBe(1);
    }
  });

  it("liga a semana ao mês do seu primeiro dia", () => {
    const byLabel = (label: string) =>
      plan.weeks.find((w) => w.label === label)!;
    expect(byLabel("26 Jan ➝ 1 Fev").monthIndex).toBe(0); // começa em janeiro
    expect(byLabel("2 Fev ➝ 8 Fev").monthIndex).toBe(1);
  });

  it("trata ano bissexto (2024: 366 dias, começa na segunda)", () => {
    const leap = buildYearPlan(2024);
    expect(leap.days).toHaveLength(366);
    expect(leap.days.some((d) => d.date === "2024-02-29")).toBe(true);
    expect(leap.weeks[0]!.label).toBe("1 Jan ➝ 7 Jan");
    expect(leap.weeks).toHaveLength(53);
  });

  it("começa com uma semana de 1 dia quando 1º de janeiro é domingo (2023)", () => {
    const p = buildYearPlan(2023);
    expect(p.weeks[0]!.label).toBe("1 Jan ➝ 1 Jan");
    expect(p.days.filter((d) => d.weekIndex === 0)).toHaveLength(1);
    expect(p.weeks).toHaveLength(53);
  });

  it("chega a 54 semanas em ano bissexto que começa no domingo (2040)", () => {
    // Exige o template "Semana 54" no Notion; sem ele a criação responde 422
    const p = buildYearPlan(2040);
    expect(p.weeks).toHaveLength(54);
    expect(p.weeks.at(-1)!.label).toBe("31 Dez ➝ 31 Dez");
  });

  it("gera planos consistentes (índices válidos, nenhuma semana vazia)", () => {
    for (const year of [2023, 2024, 2026, 2040]) {
      expectConsistent(buildYearPlan(year));
    }
  });
});

describe("trimPlanFrom", () => {
  const full = buildYearPlan(2026);

  it("a partir de 1º de janeiro devolve o ano inteiro", () => {
    expect(trimPlanFrom(full, "2026-01-01")).toEqual(full);
  });

  it("mantém só o que falta a partir da data e reindexa as referências", () => {
    const plan = trimPlanFrom(full, "2026-10-01");

    expect(plan.days).toHaveLength(92); // out (31) + nov (30) + dez (31)
    expect(plan.days[0]!.date).toBe("2026-10-01");
    expect(plan.months.map((m) => m.name)).toEqual([
      "Outubro",
      "Novembro",
      "Dezembro",
    ]);
    expect(plan.quarters.map((q) => q.name)).toEqual(["T4"]);
    expect(plan.months.every((m) => m.quarterIndex === 0)).toBe(true);
    expect(plan.days[0]!.weekIndex).toBe(0);
    expectConsistent(plan);
  });

  it("preserva número e rótulo completo da semana que começou antes da data", () => {
    const plan = trimPlanFrom(full, "2026-10-01");
    const first = plan.weeks[0]!;

    expect(first.label).toBe("28 Set ➝ 4 Out");
    expect(first.number).toBe(
      full.weeks.find((w) => w.label === "28 Set ➝ 4 Out")!.number,
    );
    // Começou em setembro, que ficou fora do plano: índice negativo (ver doc da função)
    expect(first.monthIndex).toBe(-1);
  });

  it("no último dia do ano sobra só a última semana, com a numeração original", () => {
    const plan = trimPlanFrom(full, "2026-12-31");
    expect(plan.days).toHaveLength(1);
    expect(plan.weeks.map((w) => w.name)).toEqual(["Semana 53"]);
    expect(plan.quarters.map((q) => q.name)).toEqual(["T4"]);
  });
});

describe("buildPlan", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem recorte devolve o ano inteiro", () => {
    expect(buildPlan(2026)).toEqual(buildYearPlan(2026));
    expect(buildPlan(2026, false)).toEqual(buildYearPlan(2026));
  });

  it("com data YYYY-MM-DD recorta a partir dela", () => {
    expect(buildPlan(2026, "2026-10-01")).toEqual(
      trimPlanFrom(buildYearPlan(2026), "2026-10-01"),
    );
  });

  it("rejeita data de outro ano, inexistente ou fora do formato", () => {
    expect(() => buildPlan(2026, "2025-10-01")).toThrow(InvalidFromDateError);
    expect(() => buildPlan(2026, "2026-02-30")).toThrow(InvalidFromDateError);
    expect(() => buildPlan(2026, "01/10/2026")).toThrow(InvalidFromDateError);
  });

  it("startToday (true) recorta a partir de hoje no ano atual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 12)); // 19/nov/2026, horário local

    const plan = buildPlan(2026, true);
    expect(plan.days[0]!.date).toBe("2026-11-19");
    expect(plan.months.map((m) => m.name)).toEqual(["Novembro", "Dezembro"]);
  });

  it("startToday (true) com outro ano lança InvalidStartTodayError", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 19, 12));

    expect(() => buildPlan(2027, true)).toThrow(InvalidStartTodayError);
  });
});
