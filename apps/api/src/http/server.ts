import { env } from "@notion-automation/env";
import fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { newYear } from "./routes/new-year";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

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
    ],
  },
  transform: jsonSchemaTransform,
});

app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
});

app.register(newYear);

app.listen({ port: env.PORT_BACKEND }, () => {
  console.log(`Server started in PORT ${env.PORT_BACKEND}`);
});
