import { createYear, YearAlreadyExistsError } from "@/lib/createYear";
import { repairYear, YearNotFoundError } from "@/lib/repairYear";
import { InvalidStartTodayError } from "@/lib/routineCalendar";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

const errorResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function newYear(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/createYear",
    {
      schema: {
        tags: ["Rotine"],
        summary:
          "Cria a rotina anual completa (Ano, Trimestres, Meses, Semanas e Dias) ou repara um ano existente",
        description: [
          "**Parâmetros** (todos opcionais):",
          "",
          "- **`year`**: ano da rotina. Se não for informado, usa o ano atual.",
          "- **`startToday`**: `1` ou `0` (padrão `0`). Com `1`, considera só o que falta de hoje em diante (dias, semanas, meses e trimestres restantes). Só vale para o ano atual, senão responde 400. Pode ser combinado com `repair`.",
          "- **`repair`**: `1` ou `0` (padrão `0`). Com `1`, repara um ano que já existe: confere trimestres, meses, semanas e dias contra o calendário, cria o que faltar e religa o que estiver ligado ao pai errado. Se o ano não existir, responde 404.",
          "",
          "**Respostas**:",
          "",
          "- **`201`**: rotina criada.",
          "- **`200`**: ano reparado (`repair: 1`), com a contagem de páginas criadas e religadas.",
          "- **`400`**: `startToday` usado com um ano que não é o atual.",
          "- **`404`**: `repair: 1` com um ano que não existe.",
          "- **`409`**: o ano já existe (sem `repair`).",
          "",
          "**Atenção**: a criação completa leva alguns minutos (~430 páginas, respeitando o limite de taxa do Notion).",
        ].join("\n"),
        body: z
          .object({
            year: z.coerce
              .number()
              .int()
              .min(1970)
              .max(2100)
              .optional()
              .describe("Ano da rotina. Padrão: ano atual."),
            startToday: z.coerce
              .number()
              .int()
              .min(0)
              .max(1)
              .optional()
              .describe(
                "1 = só de hoje em diante (apenas ano atual); 0 = ano inteiro.",
              ),
            repair: z.coerce
              .number()
              .int()
              .min(0)
              .max(1)
              .optional()
              .describe(
                "1 = repara um ano existente (cria o que falta e religa); 0 = cria o ano.",
              ),
          })
          .optional(),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            year: z.number(),
            yearPageId: z.string(),
            created: z.object({
              quarters: z.number(),
              months: z.number(),
              weeks: z.number(),
              days: z.number(),
            }),
            relinked: z.object({
              months: z.number(),
              weeks: z.number(),
              days: z.number(),
            }),
          }),
          201: z.object({
            success: z.boolean(),
            message: z.string(),
            year: z.number(),
            yearPageId: z.string(),
            created: z.object({
              years: z.number(),
              quarters: z.number(),
              months: z.number(),
              weeks: z.number(),
              days: z.number(),
            }),
          }),
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const year = request.body?.year ?? new Date().getFullYear();
      const repair = request.body?.repair === 1;
      const startToday = request.body?.startToday === 1;
      const scope = startToday ? " (a partir de hoje)" : "";

      try {
        if (repair) {
          const result = await repairYear(year, startToday);
          return reply.status(200).send({
            success: true,
            message: `Rotina de ${year}${scope} conferida e reparada com sucesso.`,
            ...result,
          });
        }

        const result = await createYear(year, startToday);
        return reply.status(201).send({
          success: true,
          message: `Rotina de ${year}${scope} criada com sucesso.`,
          ...result,
        });
      } catch (error) {
        if (error instanceof InvalidStartTodayError) {
          return reply
            .status(400)
            .send({ success: false, message: error.message });
        }
        if (error instanceof YearNotFoundError) {
          return reply
            .status(404)
            .send({ success: false, message: error.message });
        }
        if (error instanceof YearAlreadyExistsError) {
          return reply
            .status(409)
            .send({ success: false, message: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          message: repair
            ? "Erro ao reparar a rotina anual."
            : "Erro ao criar a rotina anual.",
        });
      }
    },
  );
}
