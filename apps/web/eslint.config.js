import globals from "globals";
import { nextJsConfig } from "@notion-automation/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  // O script de dev lê a porta antes de o Next subir, sem o pacote `env`.
  { files: ["scripts/dev.mjs"], rules: { "no-restricted-properties": "off" } },
];
