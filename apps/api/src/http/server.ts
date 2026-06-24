import { env } from "@notion-automation/env";
import fastify from "fastify";

const app = fastify();

app.listen({ port: env.PORT }, () => {
  console.log("Server started in PORT 3000");
});
