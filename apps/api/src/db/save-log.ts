import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "./prisma";

/** Salva a resposta de sucesso de POST /years (201) e de POST /years/:year/repair (200). */
export function saveCreateYearLog(response: InputJsonValue) {
  return prisma.logCreateYear.create({ data: { response } });
}

/** Salva a resposta de sucesso de DELETE /years/:year. */
export function saveDeletedYearLog(response: InputJsonValue) {
  return prisma.logDeletedYear.create({ data: { response } });
}
