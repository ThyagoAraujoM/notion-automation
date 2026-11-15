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

| Pacote                                                 | Papel                                            |
| ------------------------------------------------------ | ------------------------------------------------ |
| `apps/api`                                             | API Fastify que fala com o Notion                |
| `apps/web`                                             | Front Next.js (ainda template)                   |
| `packages/env`                                         | Schema Zod + validação das variáveis de ambiente |
| `packages/ui`                                          | Componentes React compartilhados                 |
| `packages/eslint-config`, `packages/typescript-config` | Configs compartilhadas                           |

## Fluxo de uma requisição (API)

```
HTTP ─▶ src/http/server.ts ─▶ src/http/routes/<rota>.ts ─▶ src/lib/<caso-de-uso>.ts ─▶ src/lib/notion.ts ─▶ Notion API
          (registra plugins)    (valida com Zod, responde)    (regra de negócio)          (cliente singleton)
```

- **Rotas** (`src/http/routes/`): só HTTP — schema Zod, status code, formato da resposta.
- **lib** (`src/lib/`): regra de negócio e chamadas ao Notion. Não conhece Fastify.
- **env** (`@notion-automation/env`): única porta de entrada para `process.env`.

## Portas

| App | Variável        | Padrão |
| --- | --------------- | ------ |
| API | `PORT_BACKEND`  | 4000   |
| Web | `PORT_FRONTEND` | 3000   |

Ambos carregam o `.env` da raiz via `dotenv -e ../../.env`.

## Rotas existentes

| Método | Rota                            | Arquivo                             | Estado                                                                                                                  |
| ------ | ------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/createYear`                   | `routes/new-year.ts`                | Cria a rotina anual completa (Ano → Dias) para `year` (padrão: ano atual); 409 se o ano já existe                       |
| GET    | `/databases/:databaseId/schema` | `routes/get-database-schema.ts`     | Lista data sources e propriedades (id, nome, tipo + destino das relações) de um database; 404 se não existir/sem acesso |
| GET    | `/docs` (+ `/docs/json`)        | `server.ts` (`@fastify/swagger-ui`) | Swagger UI / spec OpenAPI gerada dos schemas Zod                                                                        |

> Swagger: `@fastify/swagger` deve ser registrado **antes** das rotas em `server.ts`. Para uma rota aparecer
> numa seção do docs, use `tags` no schema; a ordem das seções segue `openapi.tags`.

## Rotina anual (`POST /createYear`)

Body opcional `{ "year": 2027 }` (sem `year` → ano atual). Código: `routes/new-year.ts` → `lib/createYear.ts` → `lib/routineCalendar.ts` (calendário puro).

Fluxo: (1) resolve o ano → (2) consulta o database de anos pelo `Name`; se existir, **409** →
(3) `buildYearPlan` calcula trimestres/meses/semanas/dias → (4–8) cria Ano → Trimestres → Meses → Semanas → Dias,
sempre guardando o id do pai para a relação do filho. Resposta **201** com a contagem do que foi criado.

| Nível     | Propriedades preenchidas                                    | Relação com o pai        |
| --------- | ----------------------------------------------------------- | ------------------------ |
| Ano       | `Name`                                                      | —                        |
| Trimestre | `Name`, `Número do Trimestre`                               | `Anos` → ano             |
| Mês       | `Name`, `Nº do mês`                                         | `Trimestres` → trimestre |
| Semana    | `Name`, `Semana nº`, `Data` (texto, ex.: `24 Nov ➝ 30 Nov`) | `Meses` → mês            |
| Dia       | `Name`, `Dia Nº`, `Data` (date)                             | `Semana` → semana        |

Regras do calendário:

- Semanas vão de **segunda a domingo**; a Semana 1 é a que contém 1º de janeiro. Dias fora do ano não são criados, então a primeira e a última semana ficam "cortadas" (2026 tem 53 semanas).
- Cada semana liga a **um** mês: o do seu primeiro dia dentro do ano.
- `Dia Nº` é o dia da semana, **Domingo = 1 … Sábado = 7** (padrão que já existia no database).
- Se algo falhar no meio, as páginas já criadas vão para a lixeira (rollback best-effort), para o ano poder ser gerado de novo.
- Criação com no máximo 3 chamadas simultâneas (limite ~3 req/s do Notion); ~430 páginas levam alguns minutos e a requisição só responde no final.

## A preencher

- [x] Como os níveis se relacionam (propriedades de relação no Notion) — ver tabela acima
- [x] Estratégia para evitar duplicatas (ano já existe?) — consulta por `Name` no database de anos
- [ ] Uso do `DATABASE_URL` (persistência local?)
- [ ] Papel do app `web`
