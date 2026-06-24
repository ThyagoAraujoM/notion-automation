import fastify = require("fastify");

const app = fastify();

app.listen({ port: 3000 }, () => {
  console.log("Server started in PORT 3000");
});
