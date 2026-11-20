import { NOTION_SLOW, toHttpError } from "@/http/errors";
import { startOperationLog } from "@/http/operation-log";
import {
  errorResponse,
  flagSchema,
  levelCounts,
  yearSchema,
} from "@/http/schemas/common";
import { createYear } from "@/services/create-year";
import { withYearLock } from "@/services/shared/year-lock";
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
          "Cria a rotina anual completa (Ano, Trimestres, Meses, Semanas e Dias)",
        description: [
          "**Parâmetros** (body, todos opcionais):",
          "",
          "- **`year`**: ano da rotina. Se não for informado, usa o ano atual.",
          "- **`startToday`**: `1` ou `0` (padrão `0`). Com `1`, cria só o que falta de hoje em diante (dias, semanas, meses e trimestres restantes). Só vale para o ano atual, senão responde 400.",
          "",
          "**Respostas**:",
          "",
          "- **`201`**: rotina criada, com a contagem de páginas por nível.",
          "- **`400`**: body inválido ou `startToday` usado com um ano que não é o atual.",
          "- **`409`**: o ano já existe (para completar um ano existente use `POST /years/:year/repair`) ou já há outra operação (criar, reparar ou apagar) em andamento para esse ano.",
          "- **`422`**: faltam templates no Notion (a resposta lista os nomes); nada é criado.",
          "- **`504`**: o Notion passou de 60 s para responder uma chamada. O que já tinha sido criado vai para a lixeira (rollback).",
          "",
          "**Tempo estimado** (as páginas são criadas uma por vez, com template, e a requisição só responde no final; o cliente não pode ter timeout curto, ex.: `curl` sem `--max-time` baixo):",
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
          201: z.object({
            success: z.literal(true),
            message: z.string(),
            year: z.number(),
            yearPageId: z.string(),
            created: levelCounts.extend({ years: z.number() }),
          }),
          400: errorResponse,
          409: errorResponse,
          422: errorResponse,
          500: errorResponse,
          504: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const year = request.body?.year ?? new Date().getFullYear();
      const startToday = request.body?.startToday === 1;

      const log = startOperationLog(request, year, "createYear");

      try {
        const result = await withYearLock(year, "createYear", () =>
          createYear(year, startToday),
        );
        const body = {
          success: true as const,
          message: `Rotina de ${year}${startToday ? " (a partir de hoje)" : ""} criada com sucesso.`,
          ...result,
        };
        await log(201, body);
        return reply.status(201).send(body);
      } catch (error) {
        const known = toHttpError(
          error,
          [400, 409, 422, 504],
          `${NOTION_SLOW} O que já tinha sido criado foi enviado para a lixeira; tente novamente em instantes ou use POST /years/${year}/repair para conferir o ano.`,
        );
        if (known) {
          const knownBody = { success: false as const, message: known.message };
          await log(known.status, knownBody, error);
          return reply.status(known.status).send(knownBody);
        }
        request.log.error(error);
        const errorBody = {
          success: false as const,
          message: "Erro ao criar a rotina anual.",
        };
        await log(500, errorBody, error);
        return reply.status(500).send(errorBody);
      }
    },
  );
}
