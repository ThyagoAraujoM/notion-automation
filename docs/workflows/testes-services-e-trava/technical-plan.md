# Plano técnico — Testes dos services e da trava

> Spec: [spec.md](./spec.md)

## Abordagem

Services: `vi.mock` de `@/integrations/notion/client` (só `pages.create/update`, `dataSources.query/listTemplates`, `databases.retrieve`) com um Notion falso em memória por teste, mantendo os helpers reais — assim o teste cobre também a orquestração com `loadTemplates`/`queryAll`. Trava: unitário com `@/db/prisma` mockado; integração com Postgres real em config Vitest separada (`vitest.integration.config.mts`, `*.integration.test.ts`), carregando o arquivo de ambiente via `dotenv-cli` (script `env:load`).

## Arquivos e contratos afetados

| Arquivo                                                                                          | Mudança                                      |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `apps/api/src/services/{create,repair,delete}-year.test.ts`                                      | novos                                        |
| `apps/api/src/db/year-lock.test.ts`, `services/shared/year-lock.test.ts`                         | novos                                        |
| `apps/api/src/db/year-lock.integration.test.ts`, `vitest.integration.config.mts`, `package.json` | novos / script `test:integration`            |
| `docs/convencoes.md`, `CLAUDE.md`, `docs/pendencias.md`                                          | seção de testes, comando, `PF-006` resolvida |

Nenhum contrato de produção muda.

## Incrementos

| #   | Mudança                        | Critérios | Status                  |
| --- | ------------------------------ | --------- | ----------------------- |
| 1   | Spec e plano                   | —         | ✅ `112bbcb`            |
| 2   | Testes de service              | CA1–CA3   | ✅ `dc471dd`            |
| 3   | Testes unitários da trava      | CA4       | ✅ `0ae32f1`            |
| 4   | Integração com Postgres + docs | CA5, CA6  | ✅ (commit desta etapa) |

## Validação

`pnpm lint && pnpm check-types && pnpm test` na raiz; `pnpm --filter=@notion-automation/api test:integration` com `pnpm db:up`.

## Reversão

Só adiciona testes e um script: apagar os arquivos ou reverter o merge.

## Acompanhamento

- 2026-11-20 — Portão verde (133 testes); `test:integration` passou 5/5 no Postgres local. O E2E não foi rodado: nenhum código de produção mudou.
