import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// O .env fica na raiz do monorepo
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } =
  process.env;

// A CLI do Prisma precisa de uma URL: monta a partir das variáveis separadas
const url = `postgresql://${encodeURIComponent(POSTGRES_USER ?? "")}:${encodeURIComponent(POSTGRES_PASSWORD ?? "")}@localhost:${POSTGRES_PORT ?? 5432}/${POSTGRES_DB ?? ""}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
