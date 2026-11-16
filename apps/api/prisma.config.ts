import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// O .env fica na raiz do monorepo
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
