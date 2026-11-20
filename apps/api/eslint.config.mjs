import { config } from "@notion-automation/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  { ignores: ["src/generated/**"] },
  // A CLI do Prisma lê as variáveis fora do `@notion-automation/env`.
  { files: ["prisma.config.ts"], rules: { "no-restricted-properties": "off" } },
];
