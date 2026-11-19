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
      `O ano ${year} não existe no database de anos. Crie-o antes (sem repair).`,
    );
    this.name = "YearNotFoundError";
  }
}
