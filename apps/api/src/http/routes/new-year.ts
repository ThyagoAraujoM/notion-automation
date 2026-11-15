import {
  createYear,
  InvalidStartTodayError,
  YearAlreadyExistsError,
} from "@/lib/createYear";
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
          "Cria a rotina anual completa: Ano, Trimestres, Meses, Semanas e Dias",
        description:
          "Se `year` não for informado, usa o ano atual. Retorna 409 se o ano já existir. " +
          "Com `startToday: 1` cria só o que falta a partir de hoje (dias, semanas, meses e trimestres restantes); só vale para o ano atual (senão 400). " +
          "A criação leva alguns minutos (~430 páginas, respeitando o limite de taxa do Notion).",
        body: z
          .object({
            year: z.coerce.number().int().min(1970).max(2100).optional(),
            startToday: z.coerce.number().int().min(0).max(1).optional(),
          })
          .optional(),
        response: {
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
          409: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const year = request.body?.year ?? new Date().getFullYear();

      try {
        const startToday = request.body?.startToday === 1;
        const result = await createYear(year, startToday);
        return reply.status(201).send({
          success: true,
          message: startToday
            ? `Rotina de ${year} criada a partir de hoje com sucesso.`
            : `Rotina de ${year} criada com sucesso.`,
          ...result,
        });
      } catch (error) {
        if (error instanceof InvalidStartTodayError) {
          return reply
            .status(400)
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
          message: "Erro ao criar a rotina anual.",
        });
      }
    },
  );
}
