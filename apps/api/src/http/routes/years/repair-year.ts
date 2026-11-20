import { NOTION_SLOW, toHttpError } from "@/http/errors";
import { startOperationLog } from "@/http/operation-log";
import {
  errorResponse,
  flagSchema,
  levelCounts,
  yearParams,
} from "@/http/schemas/common";
import { repairYear } from "@/services/repair-year";
import { withYearLock } from "@/services/shared/year-lock";
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
          "Repara um ano existente: cria o que falta e religa páginas ligadas ao pai errado",
        description: [
          "**Parâmetros**:",
          "",
          "- **`year`** (path): obrigatório. Ano a reparar; precisa existir no database de anos.",
          "- **`startToday`** (body, opcional): `1` ou `0` (padrão `0`). Com `1`, confere só o que falta de hoje em diante. Só vale para o ano atual, senão responde 400.",
          "",
          "Confere trimestres, meses, semanas e dias contra o calendário, cria o que faltar (com template) e religa o que estiver ligado ao pai errado. Nomes e números de páginas existentes não são alterados. É idempotente: pode ser repetido sem duplicar nada.",
          "",
          "**Respostas**:",
          "",
          "- **`200`**: ano reparado, com a contagem de páginas criadas e religadas.",
          "- **`400`**: `year` inválido ou `startToday` usado com um ano que não é o atual.",
          "- **`404`**: o ano não existe (crie com `POST /years`).",
          "- **`409`**: já há outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "- **`422`**: faltam templates no Notion (a resposta lista os nomes); nada é criado.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada; basta repetir.",
          "",
          "**Tempo estimado**: ~1 min só para conferir o ano, mais ~1 s por página criada. Cada chamada ao Notion tem limite de **60 s** (`504` se estourar).",
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
          200: z.object({
            success: z.literal(true),
            message: z.string(),
            year: z.number(),
            yearPageId: z.string(),
            created: levelCounts,
            relinked: levelCounts.omit({ quarters: true }),
          }),
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
          422: errorResponse,
          500: errorResponse,
          504: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { year } = request.params;
      const startToday = request.body?.startToday === 1;

      const log = startOperationLog(request, year, "repairYear");

      try {
        const result = await withYearLock(year, "repairYear", () =>
          repairYear(year, startToday),
        );
        const body = {
          success: true as const,
          message: `Rotina de ${year}${startToday ? " (a partir de hoje)" : ""} conferida e reparada com sucesso.`,
          ...result,
        };
        await log(200, body);
        return reply.status(200).send(body);
      } catch (error) {
        const known = toHttpError(
          error,
          [400, 404, 409, 422, 504],
          `${NOTION_SLOW} Tente novamente em instantes.`,
        );
        if (known) {
          const knownBody = { success: false as const, message: known.message };
          await log(known.status, knownBody, error);
          return reply.status(known.status).send(knownBody);
        }
        request.log.error(error);
        const errorBody = {
          success: false as const,
          message: "Erro ao reparar a rotina anual.",
        };
        await log(500, errorBody, error);
        return reply.status(500).send(errorBody);
      }
    },
  );
}
