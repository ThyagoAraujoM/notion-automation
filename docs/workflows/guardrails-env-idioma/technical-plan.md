# Plano técnico — Guard-rails, env e idioma

> Spec: [spec.md](./spec.md)

## Abordagem

- Uma branch, três commits (um por PF): os três mexem na mesma tabela de `pendencias.md` e em `decisoes.md`, e branches separadas conflitariam.
- **PF-008:** `.claude/hooks/guard.mjs` (PreToolUse, matcher `Bash|PowerShell`), lógica em função pura exportada (`check(command, branch)`) testada com `node --test`; o script lê o JSON do stdin como o `format.mjs`.
- **PF-009:** regra ESLint `no-restricted-properties` (`process.env`) em `packages/eslint-config/base.js` com `off` nas exceções; teste Vitest em `apps/api` que lê como texto `packages/env/index.ts`, `turbo.json` e `.env.example` (sem importar o `env`, que valida em runtime). Duas skills curtas.
- **PF-011:** tradução na origem das mensagens (`MissingTemplatesError`, `OperationInProgressError`, handler de validação) e `z.config(z.locales.pt())`.

## Arquivos e contratos afetados

| Arquivo / contrato                                                                        | Mudança                        |
| ----------------------------------------------------------------------------------------- | ------------------------------ |
| `.claude/hooks/guard.mjs`, `guard.test.mjs`, `.claude/settings.json`                      | hook novo                      |
| `packages/eslint-config/base.js`, `apps/api/prisma.config.ts`, `apps/web/scripts/dev.mjs` | regra `process.env` + exceções |
| `apps/api/src/env-consistency.test.ts`                                                    | teste novo                     |
| `.claude/skills/nova-variavel-env`, `nova-migration`                                      | skills novas                   |
| `apps/api/src/integrations/notion/helpers.ts`, `services/shared/errors.ts`, `http/app.ts` | mensagens em português         |

Contrato público: só o **texto** de `message` muda; chaves e status HTTP iguais.

## Incrementos

| #   | Mudança                                       | Testes previstos                                               | Critérios | Pronto quando                       | Status |
| --- | --------------------------------------------- | -------------------------------------------------------------- | --------- | ----------------------------------- | ------ |
| 1   | PF-008: hook guard                            | `node --test` do guard                                         | CA1–CA3   | casos de bloqueio/permissão passam  | ✅     |
| 2   | PF-009: lint + teste de consistência + skills | teste de consistência; lint falha com `process.env` de exemplo | CA4–CA6   | portão verde                        | ✅     |
| 3   | PF-011: mensagens em português + política     | testes de mensagem (helpers, lock, validação)                  | CA7, CA8  | portão verde, docs/ADRs atualizados | ⬜     |

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`
- Hook: `echo '<json>' | node .claude/hooks/guard.mjs` e checar o exit code.

## Reversão

`git revert -m 1 <merge>` desfaz tudo; cada incremento também reverte sozinho. Sem migration nem dados externos.

## Acompanhamento

- 2026-11-20 — Zod 4.4.3 tem `z.locales.pt`; usado no PF-011.
