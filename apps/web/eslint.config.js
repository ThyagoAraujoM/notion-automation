import globals from "globals";
import { nextJsConfig } from "@notion-automation/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
];
