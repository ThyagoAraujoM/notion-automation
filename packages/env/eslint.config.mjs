import { config } from "@notion-automation/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // Único lugar que lê `process.env`.
  { files: ["index.ts"], rules: { "no-restricted-properties": "off" } },
];
