// Tradução dos erros de domínio para status HTTP, compartilhada pelas rotas de `/years`.
import { isNotionTimeout } from "@/integrations/notion/client";
import { MissingTemplatesError } from "@/integrations/notion/helpers";
import {
  OperationInProgressError,
  YearAlreadyExistsError,
  YearNotFoundError,
} from "@/services/shared/errors";
import { InvalidStartTodayError } from "@/utils/routine-calendar";

export type KnownErrorStatus = 400 | 404 | 409 | 422 | 504;

/** Status e mensagem do erro conhecido, sem olhar quais status a rota aceita. */
function classify(
  error: unknown,
  timeoutMessage: string,
): { status: KnownErrorStatus; message: string } | null {
  if (error instanceof InvalidStartTodayError) {
    return { status: 400, message: error.message };
  }
  if (error instanceof YearNotFoundError) {
    return { status: 404, message: error.message };
  }
  if (
    error instanceof YearAlreadyExistsError ||
    error instanceof OperationInProgressError
  ) {
    return { status: 409, message: error.message };
  }
  if (error instanceof MissingTemplatesError) {
    return { status: 422, message: error.message };
  }
  if (isNotionTimeout(error)) {
    return { status: 504, message: timeoutMessage };
  }
  return null;
}

/**
 * Status e mensagem de um erro conhecido entre os `allowed` da rota, ou `null`
 * (erro inesperado, ou status que a rota não declara → a rota responde 500).
 * `timeoutMessage` é o texto do 504, que muda conforme a operação (rollback ou repetir).
 */
export function toHttpError<S extends KnownErrorStatus>(
  error: unknown,
  allowed: readonly S[],
  timeoutMessage: string,
): { status: S; message: string } | null {
  const known = classify(error, timeoutMessage);
  return known &&
    (allowed as readonly KnownErrorStatus[]).includes(known.status)
    ? (known as { status: S; message: string })
    : null;
}

/** Início comum das mensagens de 504. */
export const NOTION_SLOW =
  "O Notion está demorando para responder (mais de 60 s numa chamada).";
