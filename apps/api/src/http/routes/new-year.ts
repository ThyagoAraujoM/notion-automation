import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function newYear(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/createYear",
    {
      schema: {
        tags: ["Rotine"],
        summary:
          "Create your entiry year pages routine, Year, Months, Weeks and days",
        params: z.object({
          notionToken: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean,
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      reply.status(200).send({
        success: true,
        message: "Routine created with success",
      });
    },
  );
}
