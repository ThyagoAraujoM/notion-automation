# Plano técnico — Operações de ano assíncronas

> Spec: [spec.md](./spec.md)

## Abordagem

- **Job no próprio processo, estado no Postgres.** A rota obtém a trava, grava o job (`year_job`, status `running`), dispara a operação **sem `await`** e responde 202. A promise do job roda no event loop do Node enquanto a API atende outras requisições. Ao terminar, ela grava o desfecho no job e no `operation_log` e libera a trava. O cliente consulta `GET /years/jobs/:jobId`.
- **Tabela `year_job`** (modelo `YearJob`): `id` (uuid), `year`, `operation` (enum `OperationType`, reaproveitado), `status` (enum novo `JobStatus`: `running` | `succeeded` | `failed`), `params` (JSON do pedido), `status_code`, `result` (corpo que a rota síncrona daria), `error` (mensagem interna), `created_at`, `finished_at`. Índice em `(year, created_at)`. Acesso em `src/db/year-job.ts`.
- **Trava:** `withYearLock(fn)` vira `acquireYearLock(year, op)`, que lança `OperationInProgressError` (409 síncrono) ou devolve a função `release`. O runner chama `release` no `finally` do job.
- **Runner** `src/http/year-job.ts` → `startYearJob({ request, year, operation, params, run, toResult })`: trava → cria o job (se falhar, libera a trava e relança, virando 500 síncrono) → dispara `run()`. Ao terminar, `toResult` (definido em cada rota) converte sucesso ou erro em `{ statusCode, body }` usando o `toHttpError` de hoje. Toda a cadeia termina em `.catch` que só loga. Mora em `http/` porque produz status HTTP. As promises em andamento ficam num `Set`, e `settleYearJobs()` espera todas: os testes usam para aguardar o fim do job sem `setTimeout`.
- **400 de `startToday` síncrono:** a rota chama `buildPlan(year, startToday)` antes de aceitar (função pura e rápida, que lança `InvalidStartTodayError`).
- **Boot:** `server.ts` chama `failInterruptedYearJobs()` junto com `clearYearLocks()`.
- **`operation_log`:** `startOperationLog` é chamado na rota, no momento do pedido. O `log` é chamado no 400/409 síncrono ou no fim do job, então `duration_ms` mede o tempo total da operação.

Alternativas descartadas:

- **pg-boss / graphile-worker** (sugestão da PF-001): oferecem retentativa, vários workers e agendamento, nada disso necessário aqui. A API é uma instância só, o `createYear` tem rollback próprio e repair e delete são idempotentes. Retentar sozinho poderia até duplicar páginas. Seria uma dependência e um processo a mais sem ganho.
- **Reaproveitar `operation_log` como tabela de job:** o log é histórico imutável de uma linha por operação concluída. Misturar "em andamento" com "concluído" exigiria colunas nulas e updates no log.
- **Job só em memória (Map):** o status se perde ao reiniciar e o cliente receberia 404 de um job que existiu.
- **Server-Sent Events / WebSocket:** resolvem o progresso em tempo real, mas mantêm uma conexão longa aberta, que é justamente o problema a evitar.

## Arquivos e contratos afetados

| Arquivo / contrato                                        | Mudança                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| `apps/api/prisma/schema.prisma` + migration               | modelo `YearJob`, enum `JobStatus`             |
| `apps/api/src/db/year-job.ts` (novo)                      | criar, finalizar, buscar, falhar interrompidos |
| `apps/api/src/services/shared/year-lock.ts`               | `withYearLock` → `acquireYearLock`             |
| `apps/api/src/http/year-job.ts` (novo)                    | runner + `settleYearJobs`                      |
| `apps/api/src/http/routes/years/*.ts`                     | 202 nas três rotas; `get-year-job.ts` novo     |
| `apps/api/src/http/server.ts`                             | falhar jobs interrompidos ao subir             |
| `apps/api/src/http/app.ts`                                | comentário do `requestTimeout: 0`              |
| testes de rota e `app.test.ts`                            | novo contrato                                  |
| docs, ADR 017, `pendencias.md`, landing page (`apps/web`) | conhecimento                                   |

Contratos: **as três rotas mudam de 200/201 para 202** e entra `GET /years/jobs/:jobId`. Muda o banco (tabela nova, sem mexer nas existentes).

## Incrementos

| #   | Mudança                                                                   | Testes previstos                                                                                                                    | Critérios            | Pronto quando  | Status |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------- | ------ |
| 1   | Spec e plano                                                              | — (docs)                                                                                                                            | —                    | commitados     | ⏳     |
| 2   | `YearJob` + migration + `db/year-job.ts` + recuperação no boot            | migration aplicada no Postgres local; `migrate diff` sem drift; check-types                                                         | CA7 (parte de banco) | portão verde   | ⏳     |
| 3   | `acquireYearLock`, runner, `GET /years/jobs/:jobId`, as três rotas em 202 | `years.test.ts`: 202 + Location; 400/409 síncronos; job ok/falho (404/409/422/504/500); trava liberada; log no fim; GET 200/404/400 | CA1–CA6, CA8         | portão verde   | ⏳     |
| 4   | Docs, Swagger, ADR 017, landing, pendências                               | `app.test.ts` com a rota nova                                                                                                       | CA9                  | docs coerentes | ⏳     |

As três rotas mudam no mesmo incremento: `withYearLock` sai, e manter duas formas de travar só para deixar um commit intermediário verde não compensa.

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`.
- Banco: `db:deploy` no Postgres local e `prisma migrate diff` sem drift.
- Manual sem escrever no Notion: subir a API, `DELETE /years/1990` → 202 e, em seguida, `GET` do `statusUrl` → `failed` com `statusCode: 404`. `POST /years` com o ano atual (que já existe) → 202 e depois `failed` com 409.
- E2E (Notion real): não é necessário, porque os services não mudam.

## Reversão

Reverter o merge volta as rotas para o modo síncrono. A tabela `year_job` pode ficar (não é usada) ou sair numa migration nova.

## Acompanhamento

- 2026-11-20 — Escopo: o usuário escolheu aplicar o 202 nas três rotas (não só no `POST /years`).
