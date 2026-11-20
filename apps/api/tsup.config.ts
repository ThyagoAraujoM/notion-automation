import { defineConfig } from "tsup";

// Empacota a API em um único `dist/server.js`. As dependências do npm ficam externas (vêm do
// `node_modules`); o `@notion-automation/env` é TypeScript puro do workspace, então entra no bundle.
export default defineConfig({
  entry: { server: "src/http/server.ts" },
  format: "cjs",
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: ["@notion-automation/env"],
});
