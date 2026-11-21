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

  const releaseLock = await acquireYearLock(year, operation);
  // Idempotente: o shutdown e o fim do job podem soltar a mesma trava, e `releaseYearLock`
  // apaga pelo ano, não pelo dono (a segunda chamada poderia apagar a trava de outra operação).
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await releaseLock();
  };

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

      // Se o shutdown já marcou o job como `failed` e o job terminar antes de o processo sair,
      // o desfecho real sobrescreve a marca de interrupção: é intencional (é o que de fato houve).
      await saveOutcome(
        jobId,
        {
          status: outcome.statusCode < 400 ? "succeeded" : "failed",
          statusCode: outcome.statusCode,
          result: outcome.body,
          error: errorMessage(outcome.error),
          finishedAt: new Date(),
        },
        request.log,
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

/** Tentativas de gravar o desfecho do job e espera (multiplicada pela tentativa) entre elas. */
const SAVE_ATTEMPTS = 3;
const SAVE_RETRY_DELAY_MS = 500;

const SAVE_FAILED_MESSAGE =
  "A operação terminou, mas não foi possível gravar o resultado. Use POST /years/:year/repair para conferir o ano.";

/**
 * Grava o desfecho do job, retentando se o banco falhar. Esgotadas as tentativas, grava um
 * `failed` genérico (para o polling não ficar em `running`); se nem isso gravar, só loga
 * (o boot seguinte marca o job como falho).
 */
async function saveOutcome(
  jobId: string,
  data: Parameters<typeof finishYearJob>[1],
  logger: FastifyRequest["log"],
) {
  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    try {
      await finishYearJob(jobId, data);
      return;
    } catch (error) {
      logger.error(
        error,
        `Falha ao finalizar o job ${jobId} (tentativa ${attempt}/${SAVE_ATTEMPTS})`,
      );
      if (attempt < SAVE_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, SAVE_RETRY_DELAY_MS * attempt),
        );
      }
    }
  }
  await finishYearJob(jobId, {
    status: "failed",
    statusCode: 500,
    result: { success: false, message: SAVE_FAILED_MESSAGE },
    error: "falha ao gravar o desfecho do job",
    finishedAt: new Date(),
  }).catch((error) =>
    logger.error(error, `Não foi possível marcar o job ${jobId} como falho`),
  );
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
