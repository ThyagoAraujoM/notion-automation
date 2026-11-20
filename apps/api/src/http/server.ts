import { env } from "@notion-automation/env";
import { prisma } from "@/db/prisma";
import { clearYearLocks } from "@/db/year-lock";
import { buildApp } from "./app";

const app = buildApp();

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

// Travas que sobraram no banco são de uma execução anterior que caiu (só há uma instância
// da API), então são limpas antes de aceitar requisições.
clearYearLocks()
  .catch((error) => app.log.error(error, "Falha ao limpar as travas de ano"))
  .finally(() => {
    app.listen({ port: env.PORT_BACKEND }, () => {
      console.log(`Server started in PORT ${env.PORT_BACKEND}`);
    });
  });
