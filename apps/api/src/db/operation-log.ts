import type { OperationStatus, OperationType } from "@/generated/prisma/client";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "./prisma";

export type OperationLogEntry = {
  year: number;
  operation: OperationType;
  status: OperationStatus;
  statusCode: number;
  /** Corpo enviado ao cliente */
  response: InputJsonValue;
  /** Mensagem interna do erro (não vai para o cliente) */
  error?: string | null;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
};

/** Grava uma linha em `operation_log` (sucesso ou erro de uma operação de ano). */
export function saveOperationLog(entry: OperationLogEntry) {
  return prisma.operationLog.create({ data: entry });
}
