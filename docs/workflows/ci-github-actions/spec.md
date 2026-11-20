# CI no GitHub Actions

- **Slug:** `ci-github-actions`
- **Tipo:** chore
- **Status:** concluída
- **Branch:** `chore/ci-github-actions`
- **PR:** [#6](https://github.com/ThyagoAraujoM/notion-automation/pull/6)
- **Criada em:** 2026-11-20

## Objetivo

Rodar o portão de qualidade (`lint`, `check-types`, `test`) e o build do web num ambiente limpo a cada PR e a cada push na `main`, para que a regra não dependa de alguém (ou da IA) lembrar de rodar. Resolve `PF-002`.

## Contexto

- Não existia `.github/workflows/`; só o `pull_request_template.md`.
- O portão é `pnpm lint && pnpm check-types && pnpm test` na raiz (Turbo). Os testes não precisam de `.env`, Postgres nem Notion: `apps/api/vitest.config.mts` injeta valores falsos e os services/db são mockados.
- O `postinstall` da API já roda `prisma generate`, então `pnpm install` basta para gerar o client.
- O Prisma 7 exige Node >= 20.19, mas o `engines` do `package.json` diz `>=18` (`PF-005`). O CI usa Node 22.
- O E2E (`test:e2e`) leva ~5 min e escreve no Notion real: não entra no CI.
- Fluxo do repositório: PR com merge commit; o check obrigatório precisa existir antes de ser exigido na branch protection.

## Critérios de aceitação

- [x] **CA1** — `.github/workflows/ci.yml` dispara em `pull_request` e em `push` na `main`, com `permissions: contents: read` e cancelamento de execuções antigas da mesma branch.
- [x] **CA2** — O job faz `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm check-types`, `pnpm test` e `pnpm build`, sem nenhum secret nem Postgres.
- [x] **CA3** — Os mesmos comandos passam localmente (portão e build do web).
- [x] **CA4** — Docs coerentes: convenção "CI" em `docs/convencoes.md`, ADR 018, `CLAUDE.md`, e `PF-002` movida para "Resolvidas".
- [x] **CA5** — O check `Portão (lint, tipos, testes, build)` roda e fica verde no PR da própria demanda.

## Fora de escopo

- Rodar o E2E ou subir Postgres no CI (`PF-006` cobre teste de integração da trava).
- Alinhar `engines.node` e criar build/start da API (`PF-005`).
- Cache do Turbo, matriz de versões do Node, deploy.
- Ativar a branch protection: é configuração do GitHub, feita pelo usuário depois do primeiro run verde.

## Riscos e dúvidas em aberto

- O CA5 só se confirma depois do push e do PR (ação externa, só com pedido do usuário).
- O `pnpm build` depende de rede para buscar fontes do Next; se ficar instável, vira um job separado ou sai.
