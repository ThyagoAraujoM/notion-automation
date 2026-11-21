# Jobs de ano não ficam `running` após shutdown ou falha ao finalizar

- **Slug:** `jobs-ano-shutdown`
- **Tipo:** bugfix
- **Status:** em revisão
- **Branch:** `fix/jobs-ano-shutdown`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Resolver a PF-016: um job de ano (`create`, `repair`, `delete`) não pode ficar `running` até o próximo boot quando a API é encerrada ou quando gravar o desfecho falha.

## Contexto

Os jobs rodam em segundo plano no processo da API (`apps/api/src/http/year-job.ts`). Hoje:

- `apps/api/src/http/server.ts:9` só desconecta o Prisma no `onClose`, e nada chama `app.close()` (não há handler de `SIGTERM`/`SIGINT`).
- Se `finishYearJob` falha (`year-job.ts:65`), o erro só é logado e o job fica `running`.

Quem consulta `GET /years/jobs/:jobId` fica em polling sem fim até a API reiniciar (o boot marca os `running` como `failed`). Esperar os jobs terminarem no shutdown foi descartado: uma operação leva minutos e o orquestrador manda `SIGKILL` em segundos.

## Comportamento atual

Encerrar a API (ou falhar a escrita do desfecho) com um job em andamento deixa o job `running` e a trava do ano no banco até o próximo boot.

## Comportamento esperado

No shutdown a API marca como `failed` os jobs `running` deste processo (mesma mensagem do boot, que manda usar `repair`/`DELETE`) e solta as travas, **sem esperar** os jobs. Falha ao gravar o desfecho é retentada e, se persistir, o job é marcado `failed`.

## Como reproduzir

1. Subir a API, disparar `DELETE /years/<ano avulso>` (202) e encerrar a API com Ctrl+C durante o job.
2. Sem subir a API de novo, consultar o job no banco (`year_job`): continua `running`, e a linha em `year_operation_lock` do ano também fica.

## Critérios de aceitação

- [x] **CA1** — Ao receber `SIGTERM` ou `SIGINT`, a API marca como `failed` (status 500, mensagem de interrupção) os jobs `running` do processo, libera as travas e só então desconecta o Prisma, sem esperar os jobs.
- [x] **CA2** — A marcação só altera jobs ainda `running`: um job que terminou no mesmo instante mantém o desfecho gravado.
- [x] **CA3** — Se `finishYearJob` falhar, é retentado algumas vezes; esgotadas as tentativas, o job é marcado `failed` (e o erro vai para o log).
- [x] **CA4** — O boot continua corrigindo `running` e travas deixados por crash ou `SIGKILL`.

## Fora de escopo

- Várias instâncias da API (ADR 017): o boot marcaria como falhos jobs vivos de outras instâncias; segue limitação conhecida. O shutdown já marca só os jobs do próprio processo.
- Cancelar o job de verdade (a operação no Notion segue até o processo morrer, sem rollback).
- Limpeza automática da tabela `year_job`.

## Riscos e dúvidas em aberto

- Em dev (`tsx watch`) o restart manda o sinal: conferir que o shutdown termina rápido e o processo sai.
- Como o shutdown precisa dos IDs dos jobs do processo, o `year-job.ts` passa a guardá-los (hoje guarda só as promessas).
