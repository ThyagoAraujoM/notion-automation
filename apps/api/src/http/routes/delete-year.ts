import { deleteYear } from "@/lib/deleteYear";
import { YearNotFoundError } from "@/lib/repairYear";
import { saveDeletedYearLog } from "@/lib/saveLog";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

const errorResponse = z.object({
  success: z.boolean(),
  message: z.string(),
});

export async function deleteYearRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    "/deleteYear",
    {
      schema: {
        tags: ["Rotine"],
        summary:
          "Apaga um ano inteiro da rotina (Ano, Trimestres, Meses, Semanas e Dias)",
        description: [
          "**Parâmetros** (query string):",
          "",
          "- **`year`**: obrigatório. Ano a apagar (ex.: `?year=2026`).",
          "",
          "**Respostas**:",
          "",
          "- **`200`**: ano apagado, com a contagem de páginas removidas por nível.",
          "- **`400`**: `year` ausente ou inválido.",
          "- **`404`**: o ano não existe no database de anos.",
          "",
          "**Atenção**: as páginas vão para a **lixeira** do Notion (recuperável por ~30 dias), não são excluídas de forma permanente. A operação leva alguns minutos (~430 páginas, respeitando o limite de taxa do Notion).",
        ].join("\n"),
        querystring: z.object({
          year: z.coerce
            .number()
            .int()
            .min(1970)
            .max(2100)
            .describe("Ano a apagar (obrigatório)."),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
            year: z.number(),
            deleted: z.object({
              years: z.number(),
              quarters: z.number(),
              months: z.number(),
              weeks: z.number(),
              days: z.number(),
            }),
          }),
          400: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { year } = request.query;

      try {
        const result = await deleteYear(year);
        const body = {
          success: true,
          message: `Rotina de ${year} enviada para a lixeira do Notion.`,
          ...result,
        };
        await saveDeletedYearLog(body).catch((e) => request.log.error(e));
        return reply.status(200).send(body);
      } catch (error) {
        if (error instanceof YearNotFoundError) {
          return reply
            .status(404)
            .send({ success: false, message: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Erro ao apagar a rotina anual.",
        });
      }
    },
  );
}
