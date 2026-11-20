import { NOTION_SLOW } from "@/http/errors";
import { startOperationLog } from "@/http/operation-log";
import {
  errorResponse,
  flagSchema,
  jobAccepted,
  yearParams,
} from "@/http/schemas/common";
import { acceptedBody, failureOutcome, startYearJob } from "@/http/year-job";
import { repairYear } from "@/services/repair-year";
import { buildPlan } from "@/utils/routine-calendar";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function repairYearRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/years/:year/repair",
    {
      schema: {
        tags: ["Rotina"],
        summary:
          "Repara um ano existente em segundo plano: cria o que falta e religa páginas ligadas ao pai errado",
        description: [
          "**Parâmetros**:",
          "",
          "- **`year`** (path): obrigatório. Ano a reparar; precisa existir no database de anos.",
          "- **`startToday`** (body, opcional): `1` ou `0` (padrão `0`). Com `1`, confere só o que falta de hoje em diante. Só vale para o ano atual, senão responde 400.",
          "",
          "Confere trimestres, meses, semanas e dias contra o calendário, cria o que faltar (com template) e religa o que estiver ligado ao pai errado. Nomes e números de páginas existentes não são alterados. É idempotente: pode ser repetido sem duplicar nada.",
          "",
          "**Respostas** (imediatas):",
          "",
          "- **`202`**: pedido aceito. O reparo roda em segundo plano; acompanhe pelo `statusUrl` (também no header `Location`).",
          "- **`400`**: `year` inválido ou `startToday` usado com um ano que não é o atual.",
          "- **`409`**: já há outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "",
          "**Resultado do job** (`GET /years/jobs/:jobId`, campo `statusCode`):",
          "",
          "- **`200`**: ano reparado; `result` traz a contagem de páginas criadas e religadas.",
          "- **`404`**: o ano não existe (crie com `POST /years`).",
          "- **`422`**: faltam templates no Notion (a mensagem lista os nomes); nada é criado.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada; basta repetir.",
          "- **`500`**: erro inesperado.",
          "",
          "**Tempo estimado do job**: ~1 min só para conferir o ano, mais ~1 s por página criada.",
        ].join("\n"),
        params: yearParams,
        body: z
          .object({
            startToday: flagSchema
              .optional()
              .describe(
                "1 = confere só de hoje em diante (apenas ano atual); 0 = ano inteiro.",
              ),
          })
          // Sem body o Fastify entrega `null` (não `undefined`): por isso nullish, e não optional
          .nullish(),
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
      const startToday = request.body?.startToday === 1;
      const fromToday = startToday ? " (a partir de hoje)" : "";

      const log = startOperationLog(request, year, "repairYear");

      try {
        // Valida o recorte antes de aceitar (é puro): startToday fora do ano atual → 400 na hora
        buildPlan(year, startToday);

        const { jobId } = await startYearJob({
          request,
          year,
          operation: "repairYear",
          params: { startToday },
          log,
          run: () => repairYear(year, startToday),
          toOutcome: (r) =>
            r.ok
              ? {
                  statusCode: 200,
                  body: {
                    success: true,
                    message: `Rotina de ${year}${fromToday} conferida e reparada com sucesso.`,
                    ...r.value,
                  },
                }
              : failureOutcome(
                  r.error,
                  [404, 422, 504],
                  `${NOTION_SLOW} Tente novamente em instantes.`,
                  "Erro ao reparar a rotina anual.",
                ),
        });

        const { statusUrl, body } = acceptedBody(
          jobId,
          year,
          "repairYear",
          `Reparo da rotina de ${year}${fromToday} iniciado.`,
        );
        return reply.status(202).header("location", statusUrl).send(body);
      } catch (error) {
        const failure = failureOutcome(
          error,
          [400, 409],
          NOTION_SLOW,
          "Erro ao reparar a rotina anual.",
        );
        if (failure.statusCode === 500) request.log.error(error);
        await log(failure.statusCode, failure.body, error);
        return reply.status(failure.statusCode).send(failure.body);
      }
    },
  );
}
