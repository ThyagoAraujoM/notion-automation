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
        description:
          "Se `year` não for informado, usa o ano atual. Sem `repair`, retorna 409 se o ano já existir. " +
          "Com `repair: 1`, o ano precisa existir (senão 404): confere trimestres, meses, semanas e dias " +
          "contra o calendário, cria o que faltar e religa o que estiver ligado ao pai errado. " +
          "Com `startToday: 1`, considera só o que falta de hoje em diante (dias, semanas, meses e trimestres restantes); " +
          "só vale para o ano atual (senão 400) e pode ser combinado com `repair`. " +
          "A criação completa leva alguns minutos (~430 páginas, respeitando o limite de taxa do Notion).",
        body: z
          .object({
            year: z.coerce.number().int().min(1970).max(2100).optional(),
            startToday: z.coerce.number().int().min(0).max(1).optional(),
            repair: z.coerce.number().int().min(0).max(1).optional(),
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
