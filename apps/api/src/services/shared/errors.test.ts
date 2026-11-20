import { describe, expect, it } from "vitest";
import { OperationInProgressError } from "./errors";

describe("OperationInProgressError", () => {
  it.each([
    ["createYear", "criação do ano"],
    ["repairYear", "reparo do ano"],
    ["deleteYear", "exclusão do ano"],
  ])("traduz a operação %s na mensagem", (heldBy, label) => {
    expect(new OperationInProgressError(2026, heldBy).message).toContain(
      `(${label}) em andamento para o ano 2026`,
    );
  });

  it("mantém o texto recebido quando a operação é desconhecida", () => {
    expect(
      new OperationInProgressError(2026, "outra operação").message,
    ).toContain("(outra operação)");
  });
});
