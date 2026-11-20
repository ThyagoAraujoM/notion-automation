import { NOTION_SLOW } from "@/http/errors";
import { startOperationLog } from "@/http/operation-log";
import {
  errorResponse,
  flagSchema,
  jobAccepted,
  yearSchema,
} from "@/http/schemas/common";
import { acceptedBody, failureOutcome, startYearJob } from "@/http/year-job";
import { createYear } from "@/services/create-year";
import { buildPlan } from "@/utils/routine-calendar";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function createYearRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/years",
    {
      schema: {
        tags: ["Rotina"],
        summary:
          "Cria a rotina anual completa (Ano, Trimestres, Meses, Semanas e Dias) em segundo plano",
        description: [
          "**Parâmetros** (body, todos opcionais):",
          "",
          "- **`year`**: ano da rotina. Se não for informado, usa o ano atual.",
          "- **`startToday`**: `1` ou `0` (padrão `0`). Com `1`, cria só o que falta de hoje em diante (dias, semanas, meses e trimestres restantes). Só vale para o ano atual, senão responde 400.",
          "",
          "**Respostas** (imediatas):",
          "",
          "- **`202`**: pedido aceito. A rotina é criada em segundo plano; acompanhe pelo `statusUrl` (também no header `Location`).",
          "- **`400`**: body inválido ou `startToday` usado com um ano que não é o atual.",
          "- **`409`**: já há outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "",
          "**Resultado do job** (`GET /years/jobs/:jobId`, campo `statusCode`):",
          "",
          "- **`201`**: rotina criada; `result` traz a contagem de páginas por nível.",
          "- **`409`**: o ano já existe (para completar um ano existente use `POST /years/:year/repair`).",
          "- **`422`**: faltam templates no Notion (a mensagem lista os nomes); nada é criado.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada. O que já tinha sido criado vai para a lixeira (rollback).",
          "- **`500`**: erro inesperado.",
          "",
          "**Tempo estimado do job** (as páginas são criadas uma por vez, com template):",
          "",
          "- **Ano completo** (~430 páginas): cerca de **6 a 7 minutos**.",
          "- **`startToday: 1`**: proporcional ao que falta (~1 s por página; de 1º de outubro em diante, uns 2 min).",
        ].join("\n"),
        body: z
          .object({
            year: yearSchema
              .optional()
              .describe("Ano da rotina. Padrão: ano atual."),
            startToday: flagSchema
              .optional()
              .describe(
                "1 = só de hoje em diante (apenas ano atual); 0 = ano inteiro.",
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
      const year = request.body?.year ?? new Date().getFullYear();
      const startToday = request.body?.startToday === 1;
      const fromToday = startToday ? " (a partir de hoje)" : "";

      const log = startOperationLog(request, year, "createYear");

      try {
        // Valida o recorte antes de aceitar (é puro): startToday fora do ano atual → 400 na hora
        buildPlan(year, startToday);

        const { jobId } = await startYearJob({
          request,
          year,
          operation: "createYear",
          params: { startToday },
          log,
          run: () => createYear(year, startToday),
          toOutcome: (r) =>
            r.ok
              ? {
                  statusCode: 201,
                  body: {
                    success: true,
                    message: `Rotina de ${year}${fromToday} criada com sucesso.`,
                    ...r.value,
                  },
                }
              : failureOutcome(
                  r.error,
                  [409, 422, 504],
                  `${NOTION_SLOW} O que já tinha sido criado foi enviado para a lixeira; tente novamente em instantes ou use POST /years/${year}/repair para conferir o ano.`,
                  "Erro ao criar a rotina anual.",
                ),
        });

        const { statusUrl, body } = acceptedBody(
          jobId,
          year,
          "createYear",
          `Criação da rotina de ${year}${fromToday} iniciada.`,
        );
        return reply.status(202).header("location", statusUrl).send(body);
      } catch (error) {
        const failure = failureOutcome(
          error,
          [400, 409],
          NOTION_SLOW,
          "Erro ao criar a rotina anual.",
        );
        if (failure.statusCode === 500) request.log.error(error);
        await log(failure.statusCode, failure.body, error);
        return reply.status(failure.statusCode).send(failure.body);
      }
    },
  );
}
