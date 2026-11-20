# Operações de ano assíncronas (202 + job + polling)

- **Slug:** `years-jobs-assincronos`
- **Tipo:** feature
- **Status:** em andamento
- **Branch:** `feat/years-jobs-assincronos`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Hoje quem chama `POST /years` fica 6–7 min com a conexão aberta esperando a resposta, e proxies, navegadores e clientes HTTP com timeout cortam a requisição no meio. A ideia é que as operações longas de `/years` (criar, reparar, apagar) respondam na hora com **202** e um `jobId`, rodem em segundo plano e possam ser acompanhadas por polling. Resolve `PF-001`.

## Contexto

- `PF-001`: `apps/api/src/http/routes/years/create-year.ts:157` espera `createYear` terminar (~430 páginas, uma por vez) antes de responder. O servidor roda com `connectionTimeout: 0` e `requestTimeout: 0` (`apps/api/src/http/app.ts:1110`) só por causa disso.
- `DELETE /years/:year` (3–4 min) e `POST /years/:year/repair` (1 min ou mais) têm o mesmo problema. O usuário escolheu aplicar o mecanismo nas três rotas.
- A trava por ano (`withYearLock`, `apps/api/src/services/shared/year-lock.ts`) envolve a operação inteira. Num job em segundo plano, ela precisa ser obtida **antes** do 202, para o 409 continuar síncrono, e liberada só quando o job termina.
- O `operation_log` (ADR 014) já registra cada operação com código e duração. Agora a linha é gravada quando o job termina.
- A API roda em uma única instância (o `server.ts` já limpa as travas ao subir partindo dessa premissa).
- Consumidores: só o Swagger e a landing page (`apps/web/app/(home)/_components/routes.tsx`, que só lista as rotas). O script E2E chama os services direto e não é afetado.

## Critérios de aceitação

- [ ] **CA1** — `POST /years`, `POST /years/:year/repair` e `DELETE /years/:year` respondem **202** com `{ success: true, message, jobId, year, operation, status: "running", statusUrl }` e o header `Location: /years/jobs/<jobId>`, sem esperar a operação terminar.
- [ ] **CA2** — Continuam síncronos (antes do 202): 400 de validação do Zod, 400 de `startToday` fora do ano atual (create e repair) e 409 quando já há uma operação em andamento para o ano. Nesses casos a operação não é iniciada.
- [ ] **CA3** — `GET /years/jobs/:jobId` responde 200 com `jobId`, `year`, `operation`, `status` (`running` | `succeeded` | `failed`), `createdAt`, `finishedAt`, `durationMs`, `statusCode` e `result`. Enquanto roda, `statusCode`/`result`/`finishedAt` são `null`. Ao terminar, `statusCode` é o código que a rota síncrona daria (201/200, ou 404/409/422/504/500) e `result` é o corpo que ela daria. 404 para um `jobId` inexistente e 400 para um id que não é UUID.
- [ ] **CA4** — Um erro dentro do job (ano já existe, ano inexistente, templates faltando, timeout do Notion, erro inesperado) marca o job como `failed`, com o código e a mensagem que a rota síncrona daria. Erro inesperado vira 500 sem vazar a mensagem interna em `result`, que fica só na coluna `error`.
- [ ] **CA5** — A trava do ano fica presa do 202 até o fim do job e é liberada em qualquer desfecho (sucesso, erro, falha ao gravar o job). Um erro no job nunca derruba o processo (nada de rejeição não tratada).
- [ ] **CA6** — Uma linha em `operation_log` por operação aceita, gravada quando o job termina, com o código final e a duração desde o pedido. Os 400/409 síncronos continuam gravando como antes.
- [ ] **CA7** — Se a API reiniciar com jobs ainda `running`, eles são marcados como `failed` ao subir (código 500, mensagem dizendo que a operação foi interrompida e sugerindo `repair`), junto com a limpeza das travas.
- [ ] **CA8** — Testes de rota (`app.inject`) cobrindo CA1–CA7, sem Notion nem Postgres e sem esperas por tempo (`setTimeout`).
- [ ] **CA9** — Docs atualizadas: Swagger das rotas, `docs/arquitetura.md`, `docs/convencoes.md` (como testar job), ADR 017, landing page, `PF-001` em "Resolvidas".

## Fora de escopo

- Fila com workers separados, retentativa automática ou várias instâncias da API (pg-boss/graphile-worker; ver ADR 017).
- Listar jobs (`GET /years/jobs?year=`) ou cancelar um job em andamento.
- Progresso parcial (quantas páginas já foram criadas).
- Mudar os services (`createYear`, `repairYear`, `deleteYear`) ou o E2E.
- Limpeza de jobs antigos da tabela.

## Riscos e dúvidas em aberto

- Muda o contrato das três rotas (200/201 viram 202). Não há consumidor programático além do Swagger.
- 409 "ano já existe", 404 "ano inexistente" e 422 "templates" dependem do Notion e por isso passam a aparecer no status do job, não na resposta do POST/DELETE.
- Job em memória: se o processo cair, a operação para no meio (o `createYear` não chega a fazer rollback). A recuperação no boot marca o job como falho e indica o `repair`.
