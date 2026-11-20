import { env } from "@notion-automation/env";
import { prisma } from "@/db/prisma";
import { failInterruptedYearJobs } from "@/db/year-job";
import { clearYearLocks } from "@/db/year-lock";
import { buildApp } from "./app";

const app = buildApp();

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

// Travas e jobs `running` que sobraram no banco são de uma execução anterior que caiu (só há
// uma instância da API): as travas são limpas e os jobs marcados como falhos antes de aceitar requisições.
Promise.all([
  clearYearLocks().catch((error) =>
    app.log.error(error, "Falha ao limpar as travas de ano"),
  ),
  failInterruptedYearJobs().catch((error) =>
    app.log.error(error, "Falha ao marcar os jobs interrompidos"),
  ),
]).finally(() => {
  app.listen({ port: env.PORT_BACKEND }, () => {
    console.log(`Server started in PORT ${env.PORT_BACKEND}`);
  });
});
