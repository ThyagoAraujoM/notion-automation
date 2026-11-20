import { findYearJob } from "@/db/year-job";
import { errorResponse, yearOperation } from "@/http/schemas/common";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function getYearJobRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/years/jobs/:jobId",
    {
      schema: {
        tags: ["Rotina"],
        summary:
          "Consulta o andamento de uma operação de ano (criar, reparar ou apagar)",
        description: [
          "**Parâmetros**:",
          "",
          "- **`jobId`** (path): obrigatório. Id devolvido no `202` de `POST /years`, `POST /years/:year/repair` ou `DELETE /years/:year`.",
          "",
          "Faça polling (ex.: a cada 5–10 s) até `status` deixar de ser `running`.",
          "",
          "**Respostas**:",
          "",
          "- **`200`**: situação do job. Enquanto `status` é `running`, `statusCode`, `result` e `finishedAt` são `null`. Com `succeeded` ou `failed`, `statusCode` e `result` são o código e o corpo que a operação daria se fosse síncrona (ver a descrição de cada rota).",
          "- **`400`**: `jobId` não é um UUID.",
          "- **`404`**: job não encontrado.",
          "- **`500`**: erro inesperado (ex.: banco fora do ar).",
        ].join("\n"),
        params: z.object({
          jobId: z.uuid().describe("Id do job (UUID)."),
        }),
        response: {
          200: z.object({
            jobId: z.string(),
            year: z.number(),
            operation: yearOperation,
            status: z
              .enum(["running", "succeeded", "failed"])
              .describe(
                "`running` enquanto roda; `succeeded` ou `failed` ao terminar.",
              ),
            createdAt: z.string().describe("Quando o pedido foi aceito (ISO)."),
            finishedAt: z.string().nullable(),
            durationMs: z.number().nullable(),
            statusCode: z
              .number()
              .nullable()
              .describe(
                "Código que a operação síncrona daria (201, 200, 404...).",
              ),
            result: z
              .looseObject({ success: z.boolean(), message: z.string() })
              .nullable()
              .describe("Corpo que a operação síncrona daria."),
          }),
          400: errorResponse,
          404: errorResponse,
          500: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const job = await findYearJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({
          success: false,
          message: `Job ${request.params.jobId} não encontrado.`,
        });
      }

      return reply.status(200).send({
        jobId: job.id,
        year: job.year,
        operation: job.operation,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        durationMs: job.finishedAt
          ? job.finishedAt.getTime() - job.createdAt.getTime()
          : null,
        statusCode: job.statusCode,
        result: job.result as { success: boolean; message: string } | null,
      });
    },
  );
}
