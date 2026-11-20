import { errorResponse } from "@/http/schemas/common";
import { getDatabaseSchema } from "@/services/get-database-schema";
import { APIErrorCode, APIResponseError } from "@notionhq/client";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function getDatabaseSchemaRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/databases/:databaseId/schema",
    {
      schema: {
        tags: ["Database"],
        summary:
          "Retorna a estrutura das data sources de um database do Notion",
        params: z.object({
          databaseId: z
            .string()
            .regex(
              /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/,
            )
            .describe(
              "ID do database do Notion (32 caracteres hexadecimais, com ou sem hífens)",
            ),
        }),
        response: {
          200: z.object({
            success: z.literal(true),
            databaseId: z.string(),
            dataSources: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                properties: z.array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                    // Só presente em propriedades do tipo "relation"
                    relation: z
                      .object({
                        databaseId: z.string(),
                        dataSourceId: z.string(),
                        type: z.enum(["single_property", "dual_property"]),
                        syncedPropertyName: z
                          .string()
                          .optional()
                          .describe(
                            "Nome da coluna espelho no database relacionado (só em dual_property)",
                          ),
                      })
                      .optional(),
                  }),
                ),
              }),
            ),
          }),
          400: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await getDatabaseSchema(request.params.databaseId);
        return reply.status(200).send({ success: true, ...result });
      } catch (error) {
        request.log.error(error);

        if (APIResponseError.isAPIResponseError(error)) {
          if (error.code === APIErrorCode.ObjectNotFound) {
            return reply.status(404).send({
              success: false,
              message:
                "Database não encontrado ou a integração não tem acesso a ele.",
            });
          }
          if (error.code === APIErrorCode.ValidationError) {
            return reply.status(400).send({
              success: false,
              message: "ID de database inválido para o Notion.",
            });
          }
        }

        return reply.status(500).send({
          success: false,
          message: "Erro ao buscar a estrutura do database.",
        });
      }
    },
  );
}
