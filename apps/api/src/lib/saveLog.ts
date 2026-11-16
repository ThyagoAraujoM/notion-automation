import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { prisma } from "./prisma";

/** Salva a resposta de sucesso de POST /createYear (criação ou repair). */
export function saveCreateYearLog(response: InputJsonValue) {
  return prisma.logCreateYear.create({ data: { response } });
}

/** Salva a resposta de sucesso de DELETE /deleteYear. */
export function saveDeletedYearLog(response: InputJsonValue) {
  return prisma.logDeletedYear.create({ data: { response } });
}
