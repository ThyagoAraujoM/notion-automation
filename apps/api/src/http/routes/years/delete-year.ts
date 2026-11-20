import { NOTION_SLOW } from "@/http/errors";
import { startOperationLog } from "@/http/operation-log";
import { errorResponse, jobAccepted, yearParams } from "@/http/schemas/common";
import { acceptedBody, failureOutcome, startYearJob } from "@/http/year-job";
import { deleteYear } from "@/services/delete-year";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

export async function deleteYearRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().delete(
    "/years/:year",
    {
      schema: {
        tags: ["Rotina"],
        summary:
          "Apaga um ano inteiro da rotina (Ano, Trimestres, Meses, Semanas e Dias) em segundo plano",
        description: [
          "**Parâmetros**:",
          "",
          "- **`year`** (path): obrigatório. Ano a apagar (ex.: `DELETE /years/2026`).",
          "",
          "**Respostas** (imediatas):",
          "",
          "- **`202`**: pedido aceito. As páginas são apagadas em segundo plano; acompanhe pelo `statusUrl` (também no header `Location`).",
          "- **`400`**: `year` inválido.",
          "- **`409`**: já existe outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "",
          "**Resultado do job** (`GET /years/jobs/:jobId`, campo `statusCode`):",
          "",
          "- **`200`**: ano apagado; `result` traz a contagem de páginas removidas por nível.",
          "- **`404`**: o ano não existe no database de anos.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada. O que já foi para a lixeira continua lá; basta repetir o pedido para apagar o que sobrou.",
          "- **`500`**: erro inesperado.",
          "",
          "**Atenção**: as páginas vão para a **lixeira** do Notion (recuperável por ~30 dias), não são excluídas de forma permanente.",
          "",
          "**Tempo estimado do job**: um ano completo (~430 páginas) leva cerca de **3 a 4 minutos** (respeitando o limite de taxa do Notion).",
        ].join("\n"),
        params: yearParams,
        response: {
          202: jobAccepted,
          400: errorResponse,
          409: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { year } = request.params;

      const log = startOperationLog(request, year, "deleteYear");

      try {
        const { jobId } = await startYearJob({
          request,
          year,
          operation: "deleteYear",
          params: {},
          log,
          run: () => deleteYear(year),
          toOutcome: (r) =>
            r.ok
              ? {
                  statusCode: 200,
                  body: {
                    success: true,
                    message: `Rotina de ${year} enviada para a lixeira do Notion.`,
                    ...r.value,
                  },
                }
              : failureOutcome(
                  r.error,
                  [404, 504],
                  `${NOTION_SLOW} Tente novamente em instantes para apagar o que sobrou.`,
                  "Erro ao apagar a rotina anual.",
                ),
        });

        const { statusUrl, body } = acceptedBody(
          jobId,
          year,
          "deleteYear",
          `Exclusão da rotina de ${year} iniciada.`,
        );
        return reply.status(202).header("location", statusUrl).send(body);
      } catch (error) {
        const failure = failureOutcome(
          error,
          [409],
          NOTION_SLOW,
          "Erro ao apagar a rotina anual.",
        );
        if (failure.statusCode === 500) request.log.error(error);
        await log(failure.statusCode, failure.body, error);
        return reply.status(failure.statusCode).send(failure.body);
      }
    },
  );
}
