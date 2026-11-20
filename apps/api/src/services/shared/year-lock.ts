import {
  releaseYearLock,
  tryAcquireYearLock,
  type YearOperation,
} from "@/db/year-lock";
import { OperationInProgressError } from "./errors";

/**
 * Trava o ano no banco para uma operação e devolve a função que libera a trava.
 * Se outra operação do mesmo ano já estiver rodando, lança `OperationInProgressError`.
 *
 * Quem trava libera: o job em segundo plano chama `release` quando termina, em qualquer
 * desfecho. `release` nunca lança (se falhar, a trava expira pelo TTL ou é limpa no boot).
 */
export async function acquireYearLock(
  year: number,
  operation: YearOperation,
): Promise<() => Promise<void>> {
  const lock = await tryAcquireYearLock(year, operation);
  if (!lock.acquired) throw new OperationInProgressError(year, lock.heldBy);
  return () =>
    releaseYearLock(year).catch((error) =>
      console.error(`Falha ao liberar a trava do ano ${year}:`, error),
    );
}
