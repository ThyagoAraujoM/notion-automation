---
name: nova-variavel-env
description: Passo a passo para adicionar uma variável de ambiente nova ao notion-automation (packages/env, turbo.json, .env.example, docker-compose se for do Postgres, docs). Use quando o usuário pedir uma variável, configuração por ambiente ou segredo novo.
---

# Nova variável de ambiente

O teste `apps/api/src/env-consistency.test.ts` e a regra de lint `no-restricted-properties` pegam o que faltar, mas faça tudo de uma vez.

1. **Nunca leia o arquivo `.env`** (o hook e o `deny` bloqueiam). A referência é o `.env.example`.
2. `packages/env/index.ts`: adicione a variável em **`server`** (Zod; `.default(...)` só se houver padrão seguro) **e** em **`runtimeEnv`** (`process.env.NOME`). É o único arquivo que lê `process.env`.
3. `turbo.json`: adicione o nome em **`globalEnv`** (senão o cache do Turbo ignora a variável e o lint `turbo/no-undeclared-env-vars` avisa).
4. `.env.example` (raiz): adicione `NOME=` com valor de exemplo, nunca real. Variável com `.default()` pode ficar comentada (`# NOME=padrão`). Se for obrigatória, o teste exige que esteja ativa.
5. Se o Postgres/Docker usar a variável, ajuste `docker-compose.yml`; se a CLI do Prisma precisar, `apps/api/prisma.config.ts` (exceção que lê `process.env`).
6. `apps/api/vitest.config.mts`: se a variável for obrigatória, acrescente um valor falso em `test.env` (os testes importam o `env`).
7. Use no código como `import { env } from "@notion-automation/env"`, nunca `process.env`.
8. Docs: se a variável muda o setup, atualize `README.md` e `docs/arquitetura.md`.
9. Rode `pnpm lint && pnpm check-types && pnpm test`. O CI não tem o arquivo `.env`, então só passa se os valores de teste estiverem completos.

Variável de **deploy** (produção) também precisa existir no ambiente de lá: avise o usuário.
