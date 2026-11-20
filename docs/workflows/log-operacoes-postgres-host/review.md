# Revisão — Log único de operações e POSTGRES_HOST

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ✅ pronto para PR (3 observações baixas, todas com destino abaixo)

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                                                                                 |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `.claude/skills/feat/SKILL.md` com `disable-model-invocation: true`, delegando à skill `feature`                                                                          |
| CA2      | ✅        | `packages/env/index.ts` (`server` + `runtimeEnv`, padrão `localhost`), `turbo.json` `globalEnv`, `db/prisma.ts`, `prisma.config.ts`; `prisma migrate status` conectou     |
| CA3      | ✅        | `schema.prisma` (`OperationLog`, enums `OperationType`/`OperationStatus`); `migrate diff --exit-code` sem drift                                                           |
| CA4      | ✅        | Um `log(...)` por caminho de resposta nas 3 rotas (confirmado pelo revisor); testes `operation_log` em `years.test.ts`; chamadas reais 404 e 409 gravaram as linhas 5 e 6 |
| CA5      | ✅        | `.catch` dentro de `startOperationLog`; testes "falha ao gravar o log não muda a resposta" (create, repair, delete)                                                       |
| CA6      | ✅        | Migration `20261120210000_operation_log`: 4 linhas antigas copiadas (1 identificada como `repairYear`/200), tabelas antigas removidas                                     |
| CA7      | ✅        | Testes de sucesso (conteúdo e duração), 404, 409 da trava, 500 com `error` interno sem vazar e validação sem log; mutação: sem o log do erro conhecido, 2 testes falham   |
| CA8      | ✅        | `docs/arquitetura.md`, `docs/convencoes.md`, ADR 014, CLAUDE.md; `PF-003`/`PF-004` movidas para "Resolvidas" na etapa de fechamento do `/pr`                              |

## Comandos executados

| Comando                                                                | Resultado                         |
| ---------------------------------------------------------------------- | --------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test`                           | ✅ 96 testes                      |
| `prisma migrate status` (via `POSTGRES_HOST`)                          | ✅ conectou                       |
| `db:deploy` + contagem antes/depois                                    | ✅ 4 → 4 linhas                   |
| `prisma migrate diff --from-config-datasource --to-schema --exit-code` | ✅ sem drift                      |
| `DELETE /years/1990`, `POST /years` 2026 na API real                   | ✅ 404 e 409 gravados com `error` |
| Subagente `revisor` sobre `main...HEAD`                                | ✅ 3 observações baixas           |

## Problemas encontrados

- [baixa] `turbo.json` — o diff reformata os arrays das tasks → aceito: o Prettier devolveu o estilo original do arquivo (o commit anterior, feito por script, tinha expandido os arrays).
- [baixa] `apps/api/src/http/routes/years/*.ts` — o log é gravado antes do `reply.send`; se a serialização da resposta falhar, a linha fica `success` com o cliente recebendo 500 → aceito: só acontece com bug de schema de resposta, coberto pelos testes de rota e do OpenAPI.
- [baixa] `migration.sql` — `("response"->>'year')::INTEGER` abortaria a migration se houvesse resposta sem `year` → aceito: todas as respostas antigas tinham `year` e a migration já foi aplicada; editar mudaria o checksum que o Prisma usa para detectar migration adulterada.

## Riscos residuais e limitações

- `.env.example` sem `POSTGRES_HOST` (o Claude não edita `.env.*`): o usuário adiciona `POSTGRES_HOST=localhost`. Sem ele, o padrão `localhost` mantém tudo funcionando.
- A mensagem interna de erros 500 fica no banco (`error`): mensagens de erro não podem carregar segredos.
- Nenhuma rota para consultar os logs: hoje é por `db:studio` ou SQL.
- Reverter o código não desfaz o banco: voltar exige nova migration (descrito no plano).
