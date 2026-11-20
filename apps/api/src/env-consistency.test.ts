import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Confere as quatro listas de variáveis de ambiente entre si. Lê os arquivos como texto:
// importar o `env` validaria o ambiente em runtime e quebraria o teste sem as variáveis.
const root = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../..", file), "utf8");

/** Chaves `NOME: ...` (4 espaços de indentação) de um trecho do `packages/env/index.ts`. */
const keysOf = (block: string) =>
  [...block.matchAll(/^ {4}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]!);

const envSource = root("packages/env/index.ts");
const [serverBlock = "", runtimeBlock = ""] = envSource.split("runtimeEnv:");
const server = keysOf(serverBlock);
const runtimeEnv = keysOf(runtimeBlock);
const globalEnv = (JSON.parse(root("turbo.json")) as { globalEnv: string[] })
  .globalEnv;

/** Variáveis do `.env.example`, ativas ou comentadas (`# NOME=`). */
const example = root(".env.example");
const exampleActive = new Set(
  [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!),
);
const exampleAny = new Set(
  [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!),
);

const sorted = (list: string[]) => [...list].sort();

describe("variáveis de ambiente", () => {
  it("encontra variáveis em packages/env (o parser não quebrou)", () => {
    expect(server.length).toBeGreaterThan(0);
  });

  it("`server` e `runtimeEnv` têm as mesmas chaves", () => {
    expect(sorted(runtimeEnv)).toEqual(sorted(server));
  });

  it("cada chave de `runtimeEnv` lê o `process.env` de mesmo nome", () => {
    const wrong = runtimeEnv.filter(
      (name) =>
        !new RegExp(String.raw`^ {4}${name}: process\.env\.${name},`, "m").test(
          runtimeBlock,
        ),
    );
    expect(wrong).toEqual([]);
  });

  it("o .env.example não tem variável que o `env` desconhece", () => {
    expect([...exampleAny].filter((name) => !server.includes(name))).toEqual(
      [],
    );
  });

  it("`globalEnv` do turbo.json lista as mesmas variáveis", () => {
    expect(sorted(globalEnv)).toEqual(sorted(server));
  });

  it("o .env.example documenta toda variável; as sem padrão são obrigatórias nele", () => {
    const withDefault = (name: string) =>
      new RegExp(String.raw`^ {4}${name}:.*\.default\(`, "m").test(serverBlock);
    const missing = server.filter((name) =>
      withDefault(name) ? !exampleAny.has(name) : !exampleActive.has(name),
    );
    expect(missing).toEqual([]);
  });
});
