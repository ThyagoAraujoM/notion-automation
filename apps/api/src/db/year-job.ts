import type { JobStatus, OperationType } from "@/generated/prisma/client";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "./prisma";

/** Mensagem gravada nos jobs que estavam rodando quando a API caiu ou reiniciou. */
export const INTERRUPTED_JOB_MESSAGE =
  "A operação foi interrompida porque a API reiniciou antes de terminar. Use POST /years/:year/repair para conferir o ano (ou DELETE /years/:year para apagar o que sobrou).";

/** Registra um job novo, já como `running`. */
export function createYearJob(data: {
  year: number;
  operation: OperationType;
  params: InputJsonValue;
}) {
  return prisma.yearJob.create({ data });
}

/** Grava o desfecho de um job. */
export function finishYearJob(
  id: string,
  data: {
    status: Exclude<JobStatus, "running">;
    statusCode: number;
    result: InputJsonValue;
    error: string | null;
    finishedAt: Date;
  },
) {
  return prisma.yearJob.update({ where: { id }, data });
}

export function findYearJob(id: string) {
  return prisma.yearJob.findUnique({ where: { id } });
}

/**
 * Marca como `failed` os jobs que ficaram `running` (o processo morreu no meio).
 * Chamado ao subir a API: só há uma instância, então nenhum job está rodando de fato.
 */
export function failInterruptedYearJobs() {
  return prisma.yearJob.updateMany({
    where: { status: "running" },
    data: {
      status: "failed",
      statusCode: 500,
      result: { success: false, message: INTERRUPTED_JOB_MESSAGE },
      error: "interrompido: a API reiniciou com o job em andamento",
      finishedAt: new Date(),
    },
  });
}
