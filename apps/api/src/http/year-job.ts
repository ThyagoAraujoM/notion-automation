import type { FastifyRequest } from "fastify";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { createYearJob, failYearJobs, finishYearJob } from "@/db/year-job";
import type { YearOperation } from "@/db/year-lock";
import { acquireYearLock } from "@/services/shared/year-lock";
import { toHttpError, type KnownErrorStatus } from "./errors";
import type { OperationLogger } from "./operation-log";

/** Código e corpo que a rota síncrona daria; é o que fica gravado no job e no log. */
export type JobOutcome<S extends number = number> = {
  statusCode: S;
  body: { success: boolean; message: string };
  error?: unknown;
};

/**
 * Jobs em andamento neste processo, por id: a promessa (ver `settleYearJobs`) e a função que
 * solta a trava do ano (ver `failRunningYearJobs`).
 */
const running = new Map<
  string,
  { job: Promise<unknown>; release: () => Promise<void> }
>();

/**
 * Aceita uma operação de ano e a executa em segundo plano.
 *
 * 1. Trava o ano (lança `OperationInProgressError` → a rota responde 409 na hora).
 * 2. Grava o job como `running` (se falhar, solta a trava e relança → 500).
 * 3. Dispara `run()` **sem esperar** e devolve o id do job, para a rota responder 202.
 *
 * Quando `run()` termina, `toOutcome` traduz o resultado (ou o erro) no código e no corpo
 * que a rota síncrona daria; isso vai para o job e para o `operation_log`, e a trava é
 * liberada. Nada aqui rejeita depois do 202: erros só vão para o log da API.
 */
export async function startYearJob<T>(options: {
  request: FastifyRequest;
  year: number;
  operation: YearOperation;
  params: InputJsonValue;
  log: OperationLogger;
  run: () => Promise<T>;
  toOutcome: (
    result: { ok: true; value: T } | { ok: false; error: unknown },
  ) => JobOutcome;
}): Promise<{ jobId: string }> {
  const { request, year, operation, params, log, run, toOutcome } = options;

  const release = await acquireYearLock(year, operation);

  let jobId: string;
  try {
    ({ id: jobId } = await createYearJob({ year, operation, params }));
  } catch (error) {
    await release();
    throw error;
  }

  const execute = async () => {
    try {
      let outcome: JobOutcome;
      try {
        outcome = toOutcome({ ok: true, value: await run() });
      } catch (error) {
        outcome = toOutcome({ ok: false, error });
      }
      if (outcome.statusCode >= 500) {
        request.log.error(outcome.error, `Erro inesperado no job ${jobId}`);
      }

      await finishYearJob(jobId, {
        status: outcome.statusCode < 400 ? "succeeded" : "failed",
        statusCode: outcome.statusCode,
        result: outcome.body,
        error: errorMessage(outcome.error),
        finishedAt: new Date(),
      }).catch((e) =>
        request.log.error(e, `Falha ao finalizar o job ${jobId}`),
      );
      await log(outcome.statusCode, outcome.body, outcome.error);
    } finally {
      await release();
    }
  };

  // Sem `await`: a requisição responde 202 e o job segue no event loop deste processo.
  const job: Promise<unknown> = execute()
    .catch((error) => request.log.error(error, `Falha no job ${jobId}`))
    .finally(() => running.delete(jobId));
  running.set(jobId, { job, release });

  return { jobId };
}

/**
 * Traduz um erro no desfecho que a rota síncrona daria: status conhecido entre os
 * `allowed` (mensagem do próprio erro) ou 500 com `fallbackMessage`, sem vazar a interna.
 */
export function failureOutcome<S extends KnownErrorStatus>(
  error: unknown,
  allowed: readonly S[],
  timeoutMessage: string,
  fallbackMessage: string,
): JobOutcome<S | 500> & { body: { success: false } } {
  const known = toHttpError(error, allowed, timeoutMessage);
  return {
    statusCode: known ? known.status : 500,
    body: {
      success: false as const,
      message: known ? known.message : fallbackMessage,
    },
    error,
  };
}

/** Corpo do 202 e caminho de consulta do job (vai também no header `Location`). */
export function acceptedBody(
  jobId: string,
  year: number,
  operation: YearOperation,
  message: string,
) {
  const statusUrl = `/years/jobs/${jobId}`;
  return {
    statusUrl,
    body: {
      success: true as const,
      message: `${message} Acompanhe em GET ${statusUrl}.`,
      jobId,
      year,
      operation,
      status: "running" as const,
      statusUrl,
    },
  };
}

/**
 * Espera todos os jobs em andamento terminarem. Usado pelos testes para checar o
 * desfecho de um job sem depender de tempo (`setTimeout`).
 */
export async function settleYearJobs() {
  while (running.size > 0)
    await Promise.all([...running.values()].map(({ job }) => job));
}

/**
 * Para o shutdown: marca como `failed` os jobs em andamento **deste processo** e solta as
 * travas dos anos, sem esperar os jobs terminarem (levam minutos e o orquestrador manda
 * `SIGKILL` em segundos). Só altera jobs ainda `running`. Se gravar a falha der erro, as
 * travas são soltas assim mesmo e o erro sobe (o boot seguinte ainda corrige o job).
 */
export async function failRunningYearJobs() {
  const jobs = [...running.entries()];
  if (jobs.length === 0) return;
  try {
    await failYearJobs(jobs.map(([id]) => id));
  } finally {
    await Promise.all(jobs.map(([, { release }]) => release()));
  }
}

function errorMessage(error: unknown) {
  if (error === undefined) return null;
  return error instanceof Error ? error.message : String(error);
}
