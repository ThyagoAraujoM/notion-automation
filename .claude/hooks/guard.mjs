// Hook PreToolUse (Bash e PowerShell): rede de segurança para duas regras do projeto.
//   1. nunca `git commit` na `main` (.claude/rules/git-workflow.md);
//   2. nunca ler o `.env` por shell (o `deny` do settings.json só cobre as ferramentas Read/Edit).
// O Claude Code envia { tool_input: { command }, cwd } pelo stdin. Bloquear = exit 2 + motivo no
// stderr (o Claude lê). Qualquer falha do próprio hook sai com 0 para nunca travar o fluxo.
// É um regex, não um sandbox: não pega ofuscação como `$(echo .env)`.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `.env` ou `.env.<algo>` como argumento: precedido de início/espaço/aspas/barra/`=`
// (não casa `process.env` nem `packages/env`) e seguido de fim/espaço/aspas/operador.
// O sufixo aceita vários pontos (`.env.production.local`) e o fim aceita curingas (`.env*`).
const ENV_FILE = /(?:^|[\s"'`/\\=<])\.env(\.[\w.-]+)?(?=$|[\s"'`;|&)<>*?[])/g;
// `.env.example` é versionado e pode ser lido (só o sufixo exato).
const ENV_SAFE_SUFFIXES = new Set([".example"]);

// Opções do git que consomem o argumento seguinte.
const GIT_OPTIONS_WITH_VALUE = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
]);

function readsEnvFile(command) {
  return [...command.matchAll(ENV_FILE)].some(
    (m) => !ENV_SAFE_SUFFIXES.has(m[1] ?? ""),
  );
}

/** Procura `git [opções] commit` em cada trecho do comando; devolve o diretório de `-C`, se houver. */
function findGitCommit(command) {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    // `git` precisa ser o comando do trecho (ignora `(`, `&`, `sudo`, `env`): `echo git commit` não conta.
    const tokens = segment
      .trim()
      .replace(/^[(&\s]+/, "")
      .split(/\s+/);
    while (tokens[0] === "sudo" || tokens[0] === "env") tokens.shift();
    const at = /^(?:.*[\\/])?git(?:\.exe)?$/.test(tokens[0] ?? "") ? 0 : -1;
    if (at === -1) continue;
    let dir;
    for (let i = at + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (!t.startsWith("-")) {
        if (t === "commit") return { dir };
        break; // outro subcomando
      }
      if (GIT_OPTIONS_WITH_VALUE.has(t)) {
        if (t === "-C") dir = tokens[i + 1]?.replace(/^["']|["']$/g, "");
        i++;
      }
    }
  }
  return null;
}

/**
 * Motivo do bloqueio ou `null` se o comando pode rodar.
 * `currentBranch(dir)` devolve a branch atual (`dir` vem do `git -C`, quando houver).
 */
export function check(command, currentBranch) {
  if (readsEnvFile(command)) {
    return "Bloqueado: o .env não pode ser lido por shell (regra do projeto). Use .env.example como referência.";
  }
  const commit = findGitCommit(command);
  // `git switch -c x && git commit`: a branch muda no meio do comando, então a atual não decide.
  const changesBranch = /\bgit\b[^;&|\n]*\s(switch|checkout)\b/.test(command);
  if (commit && !changesBranch && currentBranch(commit.dir) === "main") {
    return "Bloqueado: nunca commite direto na main. Crie uma branch <tipo>/<slug> (git switch -c ...) e commite nela.";
  }
  return null;
}

function branchOf(cwd, dir) {
  try {
    // `-C` relativo vale a partir do diretório da ferramenta, não do processo do hook.
    const target = dir ? path.resolve(cwd, dir) : cwd;
    return execFileSync("git", ["-C", target, "branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return ""; // sem git ou fora de repositório: não bloqueia
  }
}

// `realpathSync` nos dois lados: com symlink/junction o `argv[1]` difere da URL do módulo
// e o hook viraria um no-op silencioso.
const isEntry = (() => {
  try {
    return (
      realpathSync(process.argv[1] ?? "") ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();

if (isEntry) {
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let reason = null;
    try {
      const input = JSON.parse(raw);
      const command = input?.tool_input?.command;
      if (typeof command === "string") {
        const cwd = input.cwd ?? process.cwd();
        reason = check(command, (dir) => branchOf(cwd, dir));
      }
    } catch {
      // entrada inválida: segue sem bloquear
    }
    if (reason) {
      process.stderr.write(reason + "\n");
      process.exit(2);
    }
  });
}
