# Plano técnico — Log único de operações e POSTGRES_HOST

> Spec: [spec.md](./spec.md)

## Abordagem

- **`/feat`**: skill `.claude/skills/feat/SKILL.md` com `disable-model-invocation: true` que só manda seguir a skill `feature` com os argumentos. Não duplica o conteúdo (uma fonte de verdade).
- **`POSTGRES_HOST`**: `z.string().default("localhost")` no `packages/env`; `prisma.ts` usa `env.POSTGRES_HOST`; o `prisma.config.ts` (que roda fora do `env`, pela CLI) lê `process.env.POSTGRES_HOST ?? "localhost"`. O padrão mantém o `.env` atual funcionando.
- **`operation_log`**: modelo Prisma `OperationLog` com enums `OperationType` e `OperationStatus`. Gravação em `db/operation-log.ts` (`saveOperationLog`). Nas rotas, um helper `startOperationLog(request, year, operation)` (`http/operation-log.ts`) guarda o início e devolve uma função `log(statusCode, response, error?)`, que deriva `status` do código, calcula a duração e engole falha de gravação (logando no console). Cada rota chama `log` antes de cada `reply.send`.
- **Migration**: gerada com `prisma migrate dev --create-only` e editada à mão para copiar os dados das tabelas antigas antes do `DROP` (o Prisma sozinho só apagaria).

Alternativas descartadas: gravar o log dentro do `withYearLock` (é camada de service e não conhece o status HTTP); hook `onResponse` do Fastify (logaria toda rota, inclusive `/docs`, e não tem o erro interno); manter as tabelas antigas (o pedido é tabela única); `operation`/`status` como `String` (enum dá tipo e validação no banco).

## Arquivos e contratos afetados

| Arquivo / contrato                                                   | Mudança                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `.claude/skills/feat/SKILL.md`                                       | novo atalho `/feat`                                     |
| `packages/env/index.ts`, `turbo.json`                                | `POSTGRES_HOST`                                         |
| `apps/api/src/db/prisma.ts`, `apps/api/prisma.config.ts`             | host vindo da variável                                  |
| `apps/api/prisma/schema.prisma` + nova migration                     | `OperationLog`; remove `LogCreateYear`/`LogDeletedYear` |
| `apps/api/src/db/operation-log.ts` (novo), `db/save-log.ts` (remove) | gravação do log                                         |
| `apps/api/src/http/operation-log.ts` (novo)                          | helper das rotas                                        |
| `apps/api/src/http/routes/years/*.ts` e testes                       | log em sucesso e erro                                   |
| docs, ADR 014, `docs/pendencias.md`                                  | conhecimento                                            |

Contratos: respostas HTTP **não mudam**. Muda o banco (tabelas) e entra uma variável de ambiente opcional. Consumidores das tabelas antigas: só o código da API (nenhum relatório externo).

## Incrementos

| #   | Mudança                                                    | Testes previstos                                                                | Critérios     | Pronto quando                               | Status |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- | ------------------------------------------- | ------ |
| 1   | Spec, plano e skill `/feat`                                | — (docs); `/feat` aparece no harness                                            | CA1           | arquivos commitados                         | ⬜     |
| 2   | `POSTGRES_HOST` (env, turbo, prisma.ts, prisma.config)     | check-types; `prisma migrate status` conecta                                    | CA2           | sem `localhost` fixo; portão verde          | ⬜     |
| 3   | Schema + migration com cópia de dados + `saveOperationLog` | migration aplicada no Postgres local; contagem de linhas antes/depois           | CA3, CA6      | linhas antigas presentes em `operation_log` | ⬜     |
| 4   | Helper nas rotas + testes de log; remove `save-log.ts`     | `years.test.ts`: log em 201/200, 409, 422, 504, 500 (com `error`), falha do log | CA4, CA5, CA7 | portão verde                                | ⬜     |
| 5   | Docs, ADR 014, pendências                                  | —                                                                               | CA8           | docs coerentes                              | ⬜     |

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`.
- Banco: aplicar a migration no Postgres local (Docker, já no ar) e comparar contagens das tabelas antigas com `operation_log`.
- Manual (o usuário repete): subir a API e chamar `DELETE /years/1990` (404) e `POST /years` com 2026 (409); conferir as duas linhas novas em `operation_log` com status `error`.

## Reversão

Reverter o commit do squash não desfaz o banco. Para voltar: nova migration que recria as duas tabelas e copia de volta de `operation_log` (sucessos por operação). Dados de erro não têm destino nas tabelas antigas.

## Acompanhamento

- 2026-11-20 — Postgres local no ar (`notion-automation-postgres`, healthy). `.env.example` precisa de `POSTGRES_HOST=localhost`, a cargo do usuário.
