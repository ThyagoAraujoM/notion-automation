import { env } from "@notion-automation/env";
import fastify from "fastify";
import { newYear } from "./routes/new-year";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.register(newYear);

app.listen({ port: env.PORT }, () => {
  console.log(`Server started in PORT ${env.PORT}`);
});
