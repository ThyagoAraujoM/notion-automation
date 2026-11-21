# Plano técnico — Jobs de ano no shutdown

> Spec: [spec.md](./spec.md)

## Abordagem

Causa raiz: o encerramento do processo não passa por nenhum código que feche os jobs (`server.ts` não captura sinais e o `onClose` só desconecta o Prisma), e `finishYearJob` é chamado uma vez, com falha só logada (`year-job.ts:65`).

Correção: `year-job.ts` passa a guardar os IDs dos jobs em andamento e expõe `failRunningYearJobs()`, que chama uma nova função de `db/year-job.ts` (`updateMany` com `where: { id: { in }, status: "running" }`) e solta as travas dos anos. `server.ts` registra `SIGTERM`/`SIGINT`, que chamam `app.close()`; o `onClose` roda `failRunningYearJobs()` **antes** do `$disconnect`. `finishYearJob` ganha retentativa curta com fallback para `failed`. Esperar os jobs (`settleYearJobs` + timeout) foi descartado: estoura o prazo do `SIGKILL`.

## Arquivos e contratos afetados

| Arquivo / contrato                                              | Mudança                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/api/src/db/year-job.ts`                                   | `failYearJobs(ids)` só em `running`; mensagem de shutdown           |
| `apps/api/src/http/year-job.ts`                                 | guarda IDs, `failRunningYearJobs()`, retentativa de `finishYearJob` |
| `apps/api/src/http/server.ts`                                   | handlers de sinal e `onClose` na ordem certa                        |
| `apps/api/src/db/year-lock.ts`                                  | possível helper para soltar as travas de anos dos jobs              |
| testes ao lado (`db/year-job.test.ts`, `year-job`)              | regressão dos CA1–CA3                                               |
| `docs/arquitetura.md`, `docs/decisoes.md`, `docs/pendencias.md` | ciclo de vida do job no shutdown; ADR; PF-016 resolvida             |

Sem mudança de contrato público (rotas, status, schema do banco).

## Incrementos

| #   | Mudança                                                          | Testes previstos                                         | Critérios | Pronto quando               | Status |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------- | --------- | --------------------------- | ------ |
| 1   | Teste que falha + `failYearJobs` (só `running`) e IDs em memória | unitário (Prisma mockado): só `running`, ids do processo | CA1, CA2  | teste falhava antes e passa | ⏳     |
| 2   | Shutdown: handlers de sinal, `onClose` marca falha e solta trava | unitário do `failRunningYearJobs`; manual com Ctrl+C     | CA1, CA4  | portão verde + conferido    | ⏳     |
| 3   | Retentativa e fallback de `finishYearJob`                        | unitário: falha 1x e passa; falha sempre → `failed`      | CA3       | portão verde                | ⏳     |
| 4   | Docs (arquitetura, ADR, PF-016 resolvida)                        | —                                                        | —         | docs coerentes              | ⏳     |

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`
- Manual: subir a API, `DELETE /years/<ano avulso>` (202), Ctrl+C no meio, subir de novo e conferir `GET /years/jobs/:jobId` como `failed` na hora do shutdown (consulta direta ao banco).
- `test:e2e` não é necessário: os services não mudam.

## Reversão

`git revert -m 1 <merge>`. Sem migration.

## Acompanhamento

- 2026-11-20 — Demanda aberta a partir da PF-016, com a abordagem "marcar como `failed` no shutdown" (em vez de esperar os jobs) decidida com o usuário.
