import { env } from "@notion-automation/env";
import { prisma } from "@/db/prisma";
import { failInterruptedYearJobs } from "@/db/year-job";
import { clearYearLocks } from "@/db/year-lock";
import { buildApp } from "./app";
import { failRunningYearJobs } from "./year-job";

const app = buildApp();

// No shutdown os jobs em andamento viram `failed` e as travas são soltas (sem esperar os jobs,
// que levam minutos), antes de desconectar o banco. Se a escrita falhar, o boot seguinte corrige.
app.addHook("onClose", async () => {
  await failRunningYearJobs().catch((error) =>
    app.log.error(error, "Falha ao marcar os jobs em andamento no shutdown"),
  );
  await prisma.$disconnect();
});

// Sem isso o processo morre sem passar pelo `onClose`.
// O primeiro sinal fecha com calma, mas com limite (banco fora do ar pode pendurar o `onClose`);
// um segundo sinal força a saída.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (closing) process.exit(1);
    closing = true;
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    app.log.info(`${signal} recebido, encerrando a API`);
    app.close().then(
      () => process.exit(0),
      (error) => {
        app.log.error(error, "Falha ao encerrar a API");
        process.exit(1);
      },
    );
  });
}

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
