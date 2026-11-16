import { env } from "@notion-automation/env";
import fastify, { type FastifyError } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { prisma } from "@/lib/prisma";
import { newYear } from "./routes/new-year";
import { deleteYearRoute } from "./routes/delete-year";
import { getDatabaseSchemaRoute } from "./routes/get-database-schema";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

const app = fastify().withTypeProvider<ZodTypeProvider>();

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
        name: "Rotine",
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

app.register(newYear);
app.register(deleteYearRoute);
app.register(getDatabaseSchemaRoute);

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

app.listen({ port: env.PORT_BACKEND }, () => {
  console.log(`Server started in PORT ${env.PORT_BACKEND}`);
});
