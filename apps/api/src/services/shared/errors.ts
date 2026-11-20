// Erros de domínio compartilhados pelos services da rotina anual.

export class YearAlreadyExistsError extends Error {
  constructor(year: number) {
    super(`O ano ${year} já existe no database de anos.`);
    this.name = "YearAlreadyExistsError";
  }
}

export class YearNotFoundError extends Error {
  constructor(year: number) {
    super(
      `O ano ${year} não existe no database de anos. Crie-o antes com POST /years.`,
    );
    this.name = "YearNotFoundError";
  }
}

/** Nome legível da operação que segura a trava (o valor guardado no banco é o identificador em inglês). */
const OPERATION_LABEL: Record<string, string> = {
  createYear: "criação do ano",
  repairYear: "reparo do ano",
  deleteYear: "exclusão do ano",
};

export class OperationInProgressError extends Error {
  constructor(year: number, heldBy: string) {
    super(
      `Já existe uma operação (${OPERATION_LABEL[heldBy] ?? heldBy}) em andamento para o ano ${year}. Aguarde ela terminar antes de enviar outro pedido.`,
    );
    this.name = "OperationInProgressError";
  }
}
