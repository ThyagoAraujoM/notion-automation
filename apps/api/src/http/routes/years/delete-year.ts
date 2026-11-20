import { saveDeletedYearLog } from "@/db/save-log";
import { NOTION_SLOW, toHttpError } from "@/http/errors";
import { errorResponse, levelCounts, yearParams } from "@/http/schemas/common";
import { deleteYear } from "@/services/delete-year";
import { withYearLock } from "@/services/shared/year-lock";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function deleteYearRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    "/years/:year",
    {
      schema: {
        tags: ["Rotina"],
        summary:
          "Apaga um ano inteiro da rotina (Ano, Trimestres, Meses, Semanas e Dias)",
        description: [
          "**Parâmetros**:",
          "",
          "- **`year`** (path): obrigatório. Ano a apagar (ex.: `DELETE /years/2026`).",
          "",
          "**Respostas**:",
          "",
          "- **`200`**: ano apagado, com a contagem de páginas removidas por nível.",
          "- **`400`**: `year` inválido.",
          "- **`404`**: o ano não existe no database de anos.",
          "- **`409`**: já existe outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada. O que já foi para a lixeira continua lá; basta repetir o pedido para apagar o que sobrou.",
          "",
          "**Atenção**: as páginas vão para a **lixeira** do Notion (recuperável por ~30 dias), não são excluídas de forma permanente.",
          "",
          "**Tempo estimado**: um ano completo (~430 páginas) leva cerca de **3 a 4 minutos** (respeitando o limite de taxa do Notion); cada chamada ao Notion tem limite de 60 s (`504` se estourar).",
        ].join("\n"),
        params: yearParams,
        response: {
          200: z.object({
            success: z.literal(true),
            message: z.string(),
            year: z.number(),
            deleted: levelCounts.extend({ years: z.number() }),
          }),
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          500: errorResponse,
          504: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { year } = request.params;

      try {
        const result = await withYearLock(year, "deleteYear", () =>
          deleteYear(year),
        );
        const body = {
          success: true as const,
          message: `Rotina de ${year} enviada para a lixeira do Notion.`,
          ...result,
        };
        await saveDeletedYearLog(body).catch((e) => request.log.error(e));
        return reply.status(200).send(body);
      } catch (error) {
        const known = toHttpError(
          error,
          [404, 409, 504],
          `${NOTION_SLOW} Tente novamente em instantes para apagar o que sobrou.`,
        );
        if (known) {
          return reply
            .status(known.status)
            .send({ success: false, message: known.message });
        }
        request.log.error(error);
        return reply
          .status(500)
          .send({ success: false, message: "Erro ao apagar a rotina anual." });
      }
    },
  );
}
