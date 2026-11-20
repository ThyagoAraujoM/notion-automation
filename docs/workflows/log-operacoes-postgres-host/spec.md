# Log único de operações e POSTGRES_HOST

- **Slug:** `log-operacoes-postgres-host`
- **Tipo:** feature
- **Status:** concluída
- **Branch:** `feat/log-operacoes-postgres-host`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Registrar **toda** operação de ano (criar, reparar, apagar), com sucesso ou erro, numa única tabela consultável, e permitir que a API e a CLI do Prisma se conectem a um Postgres que não esteja em `localhost`. Resolve `PF-003` e `PF-004`. Também cria o atalho `/feat` para iniciar features.

## Contexto

- `PF-003`: hoje só o sucesso é gravado, em duas tabelas com uma coluna JSON cada (`log_create_year`, que também recebe o reparo, e `log_deleted_year`), via `apps/api/src/db/save-log.ts`. Falhas (409, 422, 504, 500) não deixam rastro no banco, e não há ano, operação nem duração em colunas próprias.
- `PF-004`: `host: "localhost"` fixo em `apps/api/src/db/prisma.ts:6` e em `apps/api/prisma.config.ts:12`. Impede rodar a API em Docker ou deploy.
- As rotas que gravam log: `apps/api/src/http/routes/years/{create-year,repair-year,delete-year}.ts`.
- Skill `feature` existe; o usuário quer chamá-la por `/feat`.

## Critérios de aceitação

- [x] **CA1** — `/feat <descrição>` inicia o mesmo fluxo da skill `feature` (atalho manual, sem gatilho automático próprio).
- [x] **CA2** — Variável `POSTGRES_HOST` (padrão `localhost`) usada pela API (`db/prisma.ts`) e pela CLI do Prisma (`prisma.config.ts`), declarada em `packages/env` (`server` e `runtimeEnv`) e no `globalEnv` do `turbo.json`. Sem `localhost` fixo no código.
- [x] **CA3** — Tabela única `operation_log` com: `year`, `operation` (`createYear` | `repairYear` | `deleteYear`), `status` (`success` | `error`), `status_code`, `response` (corpo enviado ao cliente), `error` (mensagem interna, quando houver), `started_at`, `finished_at` e `duration_ms`.
- [x] **CA4** — As três rotas de `/years` gravam uma linha por requisição que chega ao handler: sucesso (200/201) e erro (400 de `startToday`, 404, 409, 422, 504 e 500). Validação do Zod (400 antes do handler) não grava.
- [x] **CA5** — Falha ao gravar o log não muda a resposta da rota (só é logada no console da API).
- [x] **CA6** — Migration copia as linhas de `log_create_year` e `log_deleted_year` para `operation_log` (reparo identificado pela chave `relinked`) e remove as tabelas antigas. Nenhum log existente se perde.
- [x] **CA7** — Testes de rota conferem o log em sucesso, em erro conhecido e em erro inesperado (com a mensagem interna em `error` e sem vazá-la na resposta).
- [x] **CA8** — Docs atualizadas (arquitetura, convenções de teste, ADR, pendências `PF-003`/`PF-004` resolvidas).

## Fora de escopo

- Rota para consultar os logs (vira pendência se fizer sentido).
- 202 + fila de jobs (`PF-001`), que vai usar esta tabela como base de status.
- Rodar a API em Docker (só destrava; `PF-005`).
- A trava `year_operation_lock` continua como está.

## Riscos e dúvidas em aberto

- `.env.example` não pode ser editado pelo Claude (regra de permissão `.env.*`): o usuário adiciona `POSTGRES_HOST=localhost`.
- Linhas migradas não têm duração conhecida: `duration_ms` nulo e `started_at = finished_at = created_at` original.
