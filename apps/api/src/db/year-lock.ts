import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export type YearOperation = "createYear" | "repairYear" | "deleteYear";

/**
 * Passado esse tempo, uma trava é considerada de um processo que morreu e é descartada.
 * A trava dura o job inteiro (do 202 ao fim): precisa ser bem maior que o job mais longo (~7 min).
 */
export const YEAR_LOCK_TTL_MS = 60 * 60 * 1000;

export type YearLockResult =
  | { acquired: true }
  | { acquired: false; heldBy: string };

/**
 * Tenta travar o ano para uma operação. A chave primária (`year`) faz o banco recusar a
 * segunda tentativa, então não há corrida entre "checar" e "gravar".
 */
export async function tryAcquireYearLock(
  year: number,
  operation: YearOperation,
): Promise<YearLockResult> {
  await prisma.yearOperationLock.deleteMany({
    where: { year, startedAt: { lt: new Date(Date.now() - YEAR_LOCK_TTL_MS) } },
  });
  try {
    await prisma.yearOperationLock.create({ data: { year, operation } });
    return { acquired: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const current = await prisma.yearOperationLock.findUnique({
        where: { year },
      });
      return {
        acquired: false,
        heldBy: current?.operation ?? "outra operação",
      };
    }
    throw error;
  }
}

export async function releaseYearLock(year: number) {
  await prisma.yearOperationLock.deleteMany({ where: { year } });
}

/** Remove todas as travas (ao subir a API: travas que sobraram são de uma execução que caiu). */
export async function clearYearLocks() {
  await prisma.yearOperationLock.deleteMany();
}
