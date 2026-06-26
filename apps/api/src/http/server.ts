import { env } from "@notion-automation/env";
import fastify from "fastify";
import { newYear } from "./routes/new-year";

const app = fastify();

app.register(newYear);

app.listen({ port: env.PORT }, () => {
  console.log("Server started in PORT 3000");
});
