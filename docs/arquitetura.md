# Arquitetura

> Como o sistema é organizado. Atualize sempre que surgir um módulo novo ou o fluxo mudar.

## Objetivo

Gerar automaticamente, no Notion, a hierarquia de planejamento:

```
Ano ─┬─ Trimestre (4) ─┬─ Mês (3 por trimestre) ─┬─ Semana ─┬─ Dia
     │                 │                          │          │
  YEAR_TOKEN     QUARTERLY_TOKEN           MONTHLY_TOKEN  WEEKLY_TOKEN  DAILY_TOKEN
```

Cada nível vive em um **database próprio do Notion**. As variáveis `*_TOKEN` são os IDs desses databases
(usados em `parent.database_id`). Os níveis são ligados entre si por propriedades de relação
(a definir — ver [decisoes.md](./decisoes.md)).

## Monorepo

| Pacote | Papel |
| --- | --- |
| `apps/api` | API Fastify que fala com o Notion |
| `apps/web` | Front Next.js (ainda template) |
| `packages/env` | Schema Zod + validação das variáveis de ambiente |
| `packages/ui` | Componentes React compartilhados |
| `packages/eslint-config`, `packages/typescript-config` | Configs compartilhadas |

## Fluxo de uma requisição (API)

```
HTTP ─▶ src/http/server.ts ─▶ src/http/routes/<rota>.ts ─▶ src/lib/<caso-de-uso>.ts ─▶ src/lib/notion.ts ─▶ Notion API
          (registra plugins)    (valida com Zod, responde)    (regra de negócio)          (cliente singleton)
```

- **Rotas** (`src/http/routes/`): só HTTP — schema Zod, status code, formato da resposta.
- **lib** (`src/lib/`): regra de negócio e chamadas ao Notion. Não conhece Fastify.
- **env** (`@notion-automation/env`): única porta de entrada para `process.env`.

## Portas

| App | Variável | Padrão |
| --- | --- | --- |
| API | `PORT_BACKEND` | 4000 |
| Web | `PORT_FRONTEND` | 3000 |

Ambos carregam o `.env` da raiz via `dotenv -e ../../.env`.

## Rotas existentes

| Método | Rota | Arquivo | Estado |
| --- | --- | --- | --- |
| POST | `/createYear` | `routes/new-year.ts` | Cria só a página do ano (fixo "2026") |

## A preencher

- [ ] Como os níveis se relacionam (propriedades de relação no Notion)
- [ ] Estratégia para evitar duplicatas (ano já existe?)
- [ ] Limite de taxa da API do Notion (~3 req/s) ao criar ~365 dias
- [ ] Uso do `DATABASE_URL` (persistência local?)
- [ ] Papel do app `web`
