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

## Pendentes

- [ ] Padrão de nomes para rotas HTTP
- [ ] Framework de testes (Vitest?)
- [ ] Como relacionar os níveis no Notion
- [ ] Para que serve `DATABASE_URL`
