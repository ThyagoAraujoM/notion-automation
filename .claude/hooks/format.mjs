// Hook PostToolUse: roda o Prettier no arquivo que o Claude acabou de editar/criar.
// O Claude Code envia um JSON pelo stdin com { tool_name, tool_input: { file_path }, ... }.
// Falhas são ignoradas (exit 0) para nunca travar o fluxo do Claude.
import { execFileSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const filePath = JSON.parse(raw)?.tool_input?.file_path;
    if (!filePath || !/\.(ts|tsx|js|mjs|json|md)$/.test(filePath)) return;
    execFileSync("pnpm", ["exec", "prettier", "--write", filePath], {
      stdio: "ignore",
      shell: true,
    });
  } catch {
    // Prettier ausente ou erro de formatação: segue sem formatar.
  }
});
