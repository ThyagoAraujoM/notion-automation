import { describe, expect, it } from "vitest";
import { buildYearPlan } from "@/utils/routine-calendar";
import { dayProps, monthProps, quarterProps, weekProps } from "./year-pages";

// Os nomes das colunas precisam bater exatamente com os databases do Notion
// (ver tabela em docs/arquitetura.md). Estes testes travam esse contrato.
const plan = buildYearPlan(2026);

describe("propriedades de cada nível", () => {
  it("trimestre: Name, Número do Trimestre e relação Anos", () => {
    expect(quarterProps(plan.quarters[1]!, "year-id")).toEqual({
      Name: { title: [{ text: { content: "T2" } }] },
      "Número do Trimestre": { number: 2 },
      Anos: { relation: [{ id: "year-id" }] },
    });
  });

  it("mês: Name, Nº do mês e relação Trimestres", () => {
    expect(monthProps(plan.months[2]!, "quarter-id")).toEqual({
      Name: { title: [{ text: { content: "Março" } }] },
      "Nº do mês": { number: 3 },
      Trimestres: { relation: [{ id: "quarter-id" }] },
    });
  });

  it("semana: Name, Semana nº, Data (texto) e relação Meses", () => {
    expect(weekProps(plan.weeks[0]!, "month-id")).toEqual({
      Name: { title: [{ text: { content: "Semana 1" } }] },
      "Semana nº": { number: 1 },
      Data: { rich_text: [{ text: { content: "1 Jan ➝ 4 Jan" } }] },
      Meses: { relation: [{ id: "month-id" }] },
    });
  });

  it("dia: Name, Dia Nº (Domingo = 1), Data (date) e relação Semana", () => {
    expect(dayProps(plan.days[0]!, "week-id")).toEqual({
      Name: { title: [{ text: { content: "Quinta - Feira" } }] },
      "Dia Nº": { number: 5 },
      Data: { date: { start: "2026-01-01" } },
      Semana: { relation: [{ id: "week-id" }] },
    });
  });
});
