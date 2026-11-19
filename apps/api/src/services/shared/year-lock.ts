import {
  releaseYearLock,
  tryAcquireYearLock,
  type YearOperation,
} from "@/db/year-lock";
import { OperationInProgressError } from "./errors";

/**
 * Executa `fn` com o ano travado no banco: se outra operação do mesmo ano já estiver
 * rodando, lança `OperationInProgressError` sem executar nada. A trava é sempre liberada.
 */
export async function withYearLock<T>(
  year: number,
  operation: YearOperation,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await tryAcquireYearLock(year, operation);
  if (!lock.acquired) throw new OperationInProgressError(year, lock.heldBy);
  try {
    return await fn();
  } finally {
    // Se falhar, a trava expira sozinha (TTL) ou é limpa no próximo start da API
    await releaseYearLock(year).catch((error) =>
      console.error(`Falha ao liberar a trava do ano ${year}:`, error),
    );
  }
}
