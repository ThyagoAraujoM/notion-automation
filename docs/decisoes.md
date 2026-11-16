# Decisões (ADRs leves)

> Registro do **porquê** das escolhas. Cada decisão: contexto, decisão, alternativas, consequências.
> Ajuda o Claude (e você no futuro) a não "desfazer" escolhas conscientes.

## Modelo

```md
## NNN — Título curto

- **Data:** AAAA-MM-DD
- **Status:** proposta | aceita | substituída por NNN
- **Contexto:** qual problema estávamos resolvendo
- **Decisão:** o que escolhemos
- **Alternativas:** o que mais foi considerado e por que não
- **Consequências:** o que fica mais fácil / mais difícil
```

---

## 001 — Monorepo com Turborepo + pnpm

- **Status:** aceita
- **Contexto:** API e front no mesmo projeto, compartilhando env, configs e UI.
- **Decisão:** Turborepo + pnpm workspaces.
- **Alternativas:** _preencher_
- **Consequências:** _preencher_

## 002 — Fastify + Zod na API

- **Status:** aceita
- **Contexto:** _preencher_
- **Decisão:** Fastify 5 com `fastify-type-provider-zod` para tipar e validar rotas.
- **Alternativas:** _preencher (Express? Hono? NestJS?)_
- **Consequências:** _preencher_

## 003 — Um database do Notion por nível

- **Status:** aceita
- **Contexto:** Ano, Trimestre, Mês, Semana e Dia têm propriedades diferentes.
- **Decisão:** cada nível tem seu próprio database; IDs nas variáveis `*_TOKEN`.
- **Alternativas:** _preencher_
- **Consequências:** _preencher_

## 004 — Portas separadas para API e Web

- **Status:** aceita
- **Contexto:** ambos usavam a porta 3000 e conflitavam no `pnpm dev`.
- **Decisão:** `PORT_BACKEND` (4000) e `PORT_FRONTEND` (3000) no `packages/env`.
- **Consequências:** o `web` usa `scripts/dev.mjs` para repassar a porta ao `next dev`.

## 005 — PostgreSQL com Prisma 7, rodando no Docker

- **Data:** 2026-11-15
- **Status:** aceita
- **Contexto:** `DATABASE_URL` existia sem uso; queremos registrar o retorno das rotas de criar e apagar ano.
- **Decisão:** Postgres 17 em Docker (só o banco; a API segue com `pnpm dev`), Prisma 7 com driver adapter `pg` e uma tabela de log por rota.
- **Alternativas:** rodar a API também no Docker (descartado por ora).
- **Consequências:** é preciso subir o banco (`pnpm db:up`) antes da API. A CLI `prisma` está fixa em `7.10.1` (o tag `latest` já aponta para a 8 rc).

## Pendentes

- [ ] Padrão de nomes para rotas HTTP
- [ ] Framework de testes (Vitest?)
- [ ] Como relacionar os níveis no Notion
