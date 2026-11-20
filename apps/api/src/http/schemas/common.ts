// Schemas Zod reutilizados por mais de uma rota.
import z from "zod";

/** Corpo de toda resposta de erro (`success: false`). */
export const errorResponse = z.object({
  success: z.literal(false),
  message: z.string(),
});

/** Ano da rotina: inteiro entre 1970 e 2100 (aceita string, ex.: path ou query). */
export const yearSchema = z.coerce.number().int().min(1970).max(2100);

/** `:year` no path das rotas `/years/:year...`. */
export const yearParams = z.object({
  year: yearSchema.describe("Ano da rotina (ex.: `2026`)."),
});

/** Flag `0`/`1` (padrão `0`) usada no body. */
export const flagSchema = z.coerce.number().int().min(0).max(1);

/** Contagem de páginas por nível da rotina. */
export const levelCounts = z.object({
  quarters: z.number(),
  months: z.number(),
  weeks: z.number(),
  days: z.number(),
});
