import fastify, { type FastifyError, type FastifyServerOptions } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { getDatabaseSchemaRoute } from "./routes/databases/get-database-schema";
import { yearsRoutes } from "./routes/years";

/**
 * Monta a aplicação Fastify (error handler, Swagger e rotas) sem abrir porta nem tocar
 * no banco. O `server.ts` chama `listen`; os testes usam `app.inject()`.
 */
export function buildApp(options: FastifyServerOptions = {}) {
  // O POST /years e o repair são uma única requisição longa (minutos): sem timeout de
  // conexão nem de requisição no servidor (já é o padrão do Fastify 5; explícito para não regredir).
  const app = fastify({
    connectionTimeout: 0,
    requestTimeout: 0,
    ...options,
  }).withTypeProvider<ZodTypeProvider>();

  app.setSerializerCompiler(serializerCompiler);
  app.setValidatorCompiler(validatorCompiler);

  // Erros de validação (body/params/query) saem no formato padrão { success, message }
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        success: false,
        message: error.validation
          .map((issue) => {
            const field = issue.instancePath.replace(/\//g, ".");
            return `${error.validationContext ?? "request"}${field}: ${issue.message}`;
          })
          .join("; "),
      });
    }

    // Erros 4xx do próprio Fastify (JSON inválido, 415, 413...) mantêm o status original
    const status = error.statusCode ?? 500;
    if (status < 500) {
      return reply
        .status(status)
        .send({ success: false, message: error.message });
    }

    request.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Erro interno do servidor.",
    });
  });

  // Swagger precisa ser registrado antes das rotas (coleta via hook onRoute)
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Notion Automation API",
        description: "API que gera no Notion a rotina de planejamento",
        version: "1.0.0",
      },
      // A ordem das tags define a ordem das seções no Swagger UI
      tags: [
        {
          name: "Rotina",
          description:
            "Geração da rotina Ano → Trimestres → Meses → Semanas → Dias",
        },
        {
          name: "Database",
          description: "Inspeção da estrutura dos databases do Notion",
        },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  app.register(yearsRoutes);
  app.register(getDatabaseSchemaRoute);

  return app;
}
