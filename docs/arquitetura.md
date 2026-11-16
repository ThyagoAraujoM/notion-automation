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

| Método | Rota                            | Arquivo                             | Estado                                                                                                                                 |
| ------ | ------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/createYear`                   | `routes/new-year.ts`                | Cria a rotina anual completa (Ano → Dias) para `year` (padrão: ano atual); 409 se o ano já existe                                      |
| DELETE | `/deleteYear`                   | `routes/delete-year.ts`             | Manda para a lixeira do Notion o ano `year` (query, obrigatório) e todos os trimestres, meses, semanas e dias; 404 se o ano não existe |
| GET    | `/databases/:databaseId/schema` | `routes/get-database-schema.ts`     | Lista data sources e propriedades (id, nome, tipo + destino das relações) de um database; 404 se não existir/sem acesso                |
| GET    | `/docs` (+ `/docs/json`)        | `server.ts` (`@fastify/swagger-ui`) | Swagger UI / spec OpenAPI gerada dos schemas Zod                                                                                       |

> Swagger: `@fastify/swagger` deve ser registrado **antes** das rotas em `server.ts`. Para uma rota aparecer
> numa seção do docs, use `tags` no schema; a ordem das seções segue `openapi.tags`.

## Rotina anual (`POST /createYear`)

Body opcional `{ "year": 2027, "startToday": 0, "repair": 0 }` (sem `year` → ano atual). Código: `routes/new-year.ts` → `lib/createYear.ts` / `lib/repairYear.ts` → `lib/routineCalendar.ts` (calendário puro) e `lib/notionHelpers.ts` (consultas e propriedades).

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

**`startToday` (`1` ou `0`, padrão `0`):** com `1`, considera só o que falta a partir de hoje — dias de hoje até 31/12,
as semanas que ainda têm algum desses dias (mantendo a numeração do ano, ex.: `Semana 46`, e o rótulo completo da semana),
os meses e trimestres de hoje em diante. Só vale para o **ano atual** (outro ano → **400**). Na criação, uma semana que
começou no mês anterior liga ao primeiro mês criado; no `repair`, essa semana não é religada (o mês correto está fora do escopo).
Se o ano já existir (sem `repair`), continua 409.

**`repair` (`1` ou `0`, padrão `0`):** com `1`, em vez de criar, **repara** o ano informado (`lib/repairYear.ts`).
O ano precisa existir (senão **404**). Fluxo: busca os trimestres ligados ao ano → os meses ligados a eles → as semanas
ligadas aos meses; os **dias** são buscados pela propriedade `Data` (dentro do ano). Cada item do calendário é casado por
número (`Número do Trimestre`, `Nº do mês`, `Semana nº`) ou data, com fallback no nome. O que falta é **criado e vinculado**;
o que existe mas está ligado ao pai errado (ou a mais de um pai) é **religado** ao pai correto. Nomes e números de páginas
existentes não são alterados. Resposta **200** com `created` e `relinked` (contagens).
É idempotente (rodar de novo não duplica) e por isso não faz rollback. Limitação: semanas sem mês, ou trimestres/meses sem
ligação ao ano, não são alcançáveis pela hierarquia e seriam recriados.

Regras do calendário:

- Semanas vão de **segunda a domingo**; a Semana 1 é a que contém 1º de janeiro. Dias fora do ano não são criados, então a primeira e a última semana ficam "cortadas" (2026 tem 53 semanas).
- Cada semana liga a **um** mês: o do seu primeiro dia dentro do ano.
- `Dia Nº` é o dia da semana, **Domingo = 1 … Sábado = 7** (padrão que já existia no database).
- Se algo falhar no meio, as páginas já criadas vão para a lixeira (rollback best-effort), para o ano poder ser gerado de novo.
- Criação com no máximo 3 chamadas simultâneas (limite ~3 req/s do Notion); ~430 páginas levam alguns minutos e a requisição só responde no final.

## Banco de dados (PostgreSQL + Prisma)

- Postgres 17 local via Docker (`docker-compose.yml` na raiz): `pnpm db:up` / `pnpm db:down` / `pnpm db:logs`.
- Variáveis no `.env` da raiz: `DATABASE_URL` (ex.: `postgresql://notion:notion@localhost:5432/notion_automation`) e, opcionalmente, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` (padrões: `notion` / `notion` / `notion_automation` / `5432`).
- Prisma 7 em `apps/api/prisma/` (`schema.prisma`, `migrations/`) com `prisma.config.ts` e driver adapter `pg`. O client é gerado em `apps/api/src/generated/prisma` (ignorado no git; `pnpm --filter=@notion-automation/api db:generate`, também roda no `postinstall`).
- Client único em `apps/api/src/lib/prisma.ts`; a conexão fecha no hook `onClose` do `server.ts`.
- Comandos (em `apps/api`): `db:migrate` (cria/aplica migration em dev), `db:deploy`, `db:studio`.
- Tabelas (uma migration cada), ambas com `id`, `response` (JSON) e `created_at`:
  - `log_create_year`: resposta de sucesso (201 e 200 do `repair`) de `POST /createYear`.
  - `log_deleted_year`: resposta de sucesso de `DELETE /deleteYear`.
- A gravação do log acontece depois da operação no Notion; se o insert falhar, o erro só é logado e a resposta da rota não muda.

## A preencher

- [x] Como os níveis se relacionam (propriedades de relação no Notion) — ver tabela acima
- [x] Estratégia para evitar duplicatas (ano já existe?) — consulta por `Name` no database de anos
- [ ] Papel do app `web`
