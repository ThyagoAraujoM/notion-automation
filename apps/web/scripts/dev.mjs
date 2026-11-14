import { spawn } from "node:child_process";

// Variáveis do ../../.env já foram injetadas pelo dotenv-cli.
// O Next usa a variável PORT como porta padrão do `next dev`.
const port = Number(process.env.PORT_FRONTEND) || 3000;

const child = spawn("next dev", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(port) },
});

child.on("exit", (code) => process.exit(code ?? 0));
