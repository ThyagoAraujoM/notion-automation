# Testes dos services e da trava por ano

- **Slug:** `testes-services-e-trava`
- **Tipo:** test
- **Status:** concluída
- **Branch:** `test/testes-services-e-trava`
- **PR:** [#10](https://github.com/ThyagoAraujoM/notion-automation/pull/10)
- **Criada em:** 2026-11-20

## Objetivo

Cobrir com testes rápidos a orquestração dos services `createYear`, `repairYear` e `deleteYear` (Notion mockado) e a trava por ano (`tryAcquireYearLock`/`acquireYearLock`), para que regressões apareçam no `pnpm test` e não só no E2E (~5 min). Resolve `PF-006`.

## Contexto

- Os services (`apps/api/src/services/`) só eram exercitados pelo E2E no Notion real.
- A trava (`db/year-lock.ts`, `services/shared/year-lock.ts`) depende da chave primária do Postgres para impedir corrida; só um Postgres real prova isso.
- O CI não tem Postgres (ADR 018): o teste com banco real não pode entrar no `pnpm test`.

## Critérios de aceitação

- [x] **CA1** — `createYear`: lança `YearAlreadyExistsError` sem criar nada se o ano existe; cria ano → trimestres → meses → semanas → dias com os pais certos e devolve as contagens; se uma criação falha, manda para a lixeira o que já criou e propaga o erro; templates faltando falham antes de criar.
- [x] **CA2** — `repairYear`: lança `YearNotFoundError` se o ano não existe; não cria nem religa nada quando tudo está correto; cria o que falta; religa o que está com pai errado.
- [x] **CA3** — `deleteYear`: lança `YearNotFoundError` se o ano não existe; manda para a lixeira dias → semanas → meses → trimestres → ano e devolve as contagens.
- [x] **CA4** — Trava (unitário, Prisma mockado): adquire quando livre; com `P2002` devolve `acquired: false` e quem segura; descarta travas vencidas pelo TTL; `acquireYearLock` lança `OperationInProgressError` e o `release` nunca lança.
- [x] **CA5** — Teste de integração com Postgres real (`pnpm --filter=@notion-automation/api test:integration`), fora do `pnpm test` e do CI: duas aquisições simultâneas do mesmo ano, só uma vence; liberar permite adquirir de novo; trava vencida é reaproveitada.
- [x] **CA6** — Portão verde e docs atualizadas (`docs/convencoes.md`, `CLAUDE.md`, `PF-006` resolvida).

## Fora de escopo

- Rodar o teste de integração no CI (`services: postgres`): fica para uma demanda própria.
- Mudar o código dos services ou da trava.

## Riscos e dúvidas em aberto

- O teste de integração usa o Postgres do ambiente local (dev); só toca em anos avulsos (2091–2093) e limpa só esses.
