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

export class OperationInProgressError extends Error {
  constructor(year: number, heldBy: string) {
    super(
      `Já existe uma operação (${heldBy}) em andamento para o ano ${year}. Aguarde ela terminar antes de enviar outro pedido.`,
    );
    this.name = "OperationInProgressError";
  }
}
