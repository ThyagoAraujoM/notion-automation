// Testes do hook guard.mjs: `node --test .claude/hooks` (faz parte do `pnpm test` da raiz).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "./guard.mjs";

const onMain = () => "main";
const onFeature = () => "chore/algo";

test("bloqueia git commit na main, inclusive com opções globais e encadeado", () => {
  for (const cmd of [
    'git commit -m "x"',
    "git -C apps/api commit -m x",
    "git -c user.name=a commit --amend",
    "git add . && git commit -m x",
    "git.exe commit -m x",
    "cd x; git commit",
  ]) {
    assert.match(check(cmd, onMain) ?? "", /main/, cmd);
  }
});

test("permite git commit fora da main e outros subcomandos na main", () => {
  assert.equal(check('git commit -m "x"', onFeature), null);
  assert.equal(check("git status", onMain), null);
  assert.equal(check("git log --grep commit", onMain), null);
  assert.equal(check("git switch -c feat/x", onMain), null);
  assert.equal(check('echo "commit"', onMain), null);
});

test("usa a branch do diretório de git -C", () => {
  const seen = [];
  check("git -C ../outro commit -m x", (dir) => (seen.push(dir), "feat/x"));
  assert.deepEqual(seen, ["../outro"]);
});

test("bloqueia leitura do .env e variantes", () => {
  for (const cmd of [
    "cat .env",
    "cat apps/api/.env",
    String.raw`Get-Content .\.env`,
    'type ".env"',
    "cat .env.local",
    "source ./.env",
    "grep TOKEN .env | head",
    "cat ../.env;",
  ]) {
    assert.match(check(cmd, onFeature) ?? "", /\.env/, cmd);
  }
});

test("permite .env.example, process.env e packages/env", () => {
  for (const cmd of [
    "cat .env.example",
    "Get-Content .env.example",
    "grep -rn process.env apps",
    "cat packages/env/index.ts",
    "pnpm --filter=@notion-automation/env lint",
    "git add .gitignore",
  ]) {
    assert.equal(check(cmd, onFeature), null, cmd);
  }
});

test("script: exit 2 ao bloquear, exit 0 com entrada inválida ou comando liberado", () => {
  const run = (input) =>
    spawnSync(
      "node",
      [fileURLToPath(new URL("./guard.mjs", import.meta.url))],
      {
        input,
        encoding: "utf8",
      },
    );
  const blocked = run(JSON.stringify({ tool_input: { command: "cat .env" } }));
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /\.env/);
  assert.equal(run("não é json").status, 0);
  assert.equal(
    run(JSON.stringify({ tool_input: { command: "ls" } })).status,
    0,
  );
});

test("script: bloqueia commit na main de um repositório real", () => {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
  const res = spawnSync("node", [".claude/hooks/guard.mjs"], {
    input: JSON.stringify({
      tool_input: { command: "git commit -m x" },
      cwd: process.cwd(),
    }),
    encoding: "utf8",
  });
  assert.equal(res.status, branch === "main" ? 2 : 0);
});
