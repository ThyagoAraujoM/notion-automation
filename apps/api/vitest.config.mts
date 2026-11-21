import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mesmo alias do tsconfig (`@/*` -> `src/*`)
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Integração com Postgres real roda à parte (`test:integration`), nunca no portão/CI
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    environment: "node",
    // Valores falsos só para o `@notion-automation/env` validar ao ser importado.
    // Os testes não falam com o Notion nem com o Postgres (services e db são mockados).
    env: {
      NOTION_TOKEN: "test-token",
      YEAR_DATABASE_ID: "year-db",
      QUARTER_DATABASE_ID: "quarter-db",
      MONTH_DATABASE_ID: "month-db",
      WEEK_DATABASE_ID: "week-db",
      DAY_DATABASE_ID: "day-db",
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_DB: "test",
    },
  },
});
