import { createYear, YearAlreadyExistsError } from "@/lib/createYear";
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
          "A criação leva alguns minutos (~430 páginas, respeitando o limite de taxa do Notion).",
        body: z
          .object({
            year: z.coerce.number().int().min(1970).max(2100).optional(),
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
          409: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const year = request.body?.year ?? new Date().getFullYear();

      try {
        const result = await createYear(year);
        return reply.status(201).send({
          success: true,
          message: `Rotina de ${year} criada com sucesso.`,
          ...result,
        });
      } catch (error) {
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
