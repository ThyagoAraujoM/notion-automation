import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes de integração com o Postgres real (`pnpm db:up` + variáveis `POSTGRES_*`).
// Ficam fora de `pnpm test` e do CI. As variáveis vêm do arquivo de ambiente, carregado
// pelo script `test:integration` (sem valores falsos aqui).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    // Um arquivo por vez: os testes compartilham a tabela de travas
    fileParallelism: false,
  },
});
