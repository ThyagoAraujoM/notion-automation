import type { FastifyRequest } from "fastify";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { saveOperationLog } from "@/db/operation-log";
import type { YearOperation } from "@/db/year-lock";

/**
 * Começa a medir uma operação de ano e devolve `log(statusCode, response, error?)`,
 * que grava uma linha em `operation_log` (status derivado do código, duração calculada).
 * Chame antes de cada `reply.send` da rota. Falha ao gravar não muda a resposta:
 * só vai para o log da API.
 */
export function startOperationLog(
  request: FastifyRequest,
  year: number,
  operation: YearOperation,
) {
  const startedAt = new Date();

  return async (statusCode: number, response: object, error?: unknown) => {
    const finishedAt = new Date();
    await saveOperationLog({
      year,
      operation,
      status: statusCode < 400 ? "success" : "error",
      statusCode,
      response: response as InputJsonValue,
      error:
        error === undefined
          ? null
          : error instanceof Error
            ? error.message
            : String(error),
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    }).catch((e) => request.log.error(e, "Falha ao gravar operation_log"));
  };
}

/** Função devolvida por `startOperationLog`: grava a linha quando a operação termina. */
export type OperationLogger = ReturnType<typeof startOperationLog>;
