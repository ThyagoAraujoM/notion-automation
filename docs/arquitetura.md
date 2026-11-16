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
HTTP ─▶ src/http/server.ts ─▶ src/http/routes/<rota>.ts ─▶ src/services/<caso-de-uso>.ts ─▶ src/integrations/notion/client.ts ─▶ Notion API
          (registra plugins)    (valida com Zod, responde)    (regra de negócio)          (cliente singleton)
```

- **Rotas** (`src/http/routes/`): só HTTP — schema Zod, status code, formato da resposta.
- **services** (`src/services/`): casos de uso (regra de negócio). Não conhece Fastify.
- **utils** (`src/utils/`): lógica pura, sem I/O (ex.: calendário).
- **integrations** (`src/integrations/notion/`): cliente e helpers do Notion.
- **db** (`src/db/`): client Prisma e gravação de logs.
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

Body opcional `{ "year": 2027, "startToday": 0, "repair": 0 }` (sem `year` → ano atual). Código: `routes/new-year.ts` → `services/create-year.ts` / `services/repair-year.ts` → `utils/routine-calendar.ts` (calendário puro) e `integrations/notion/helpers.ts` (consultas e propriedades).

Fluxo: (1) resolve o ano → (2) consulta o database de anos pelo `Name`; se existir, **409** →
(3) `buildYearPlan` calcula trimestres/meses/semanas/dias → (4) busca os templates de cada database e valida que existem (senão **422**, sem criar nada) →
(5–9) cria Ano → Trimestres → Meses → Semanas → Dias, sempre guardando o id do pai para a relação do filho.
Resposta **201** com a contagem do que foi criado.

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

**`repair` (`1` ou `0`, padrão `0`):** com `1`, em vez de criar, **repara** o ano informado (`services/repair-year.ts`).
O ano precisa existir (senão **404**). Fluxo: busca os trimestres ligados ao ano → os meses ligados a eles → as semanas
ligadas aos meses; os **dias** são buscados pela propriedade `Data` (dentro do ano). Cada item do calendário é casado por
número (`Número do Trimestre`, `Nº do mês`, `Semana nº`) ou data, com fallback no nome. O que falta é **criado e vinculado**;
o que existe mas está ligado ao pai errado (ou a mais de um pai) é **religado** ao pai correto. Nomes e números de páginas
existentes não são alterados. Resposta **200** com `created` e `relinked` (contagens).
É idempotente (rodar de novo não duplica) e por isso não faz rollback. Limitação: semanas sem mês, ou trimestres/meses sem
ligação ao ano, não são alcançáveis pela hierarquia e seriam recriados.

**Templates:** cada página é criada com um template do database (`pages.create` com `template`). O **ano** usa o template
padrão (`type: "default"`); trimestre, mês, semana e dia usam o template **de mesmo nome da página** (`T1`, `Janeiro`,
`Semana 12`, `Segunda - Feira`...), buscado por `dataSources.listTemplates` a cada chamada (sem cache). Se faltar algum nome
(ex.: `Semana 53` num ano de 53 semanas), a rota responde **422** listando os que faltam, antes de criar qualquer página.
O `repair` aplica a mesma regra às páginas que ele cria.

Regras do calendário:

- Semanas vão de **segunda a domingo**; a Semana 1 é a que contém 1º de janeiro. Dias fora do ano não são criados, então a primeira e a última semana ficam "cortadas" (2026 tem 53 semanas).
- Cada semana liga a **um** mês: o do seu primeiro dia dentro do ano.
- `Dia Nº` é o dia da semana, **Domingo = 1 … Sábado = 7** (padrão que já existia no database).
- Se algo falhar no meio, as páginas já criadas vão para a lixeira (rollback best-effort), para o ano poder ser gerado de novo.
- Criação **uma página por vez** (`mapSequential`): com template + relação, criar em paralelo fez o Notion mandar páginas para a lixeira (ver decisão 006) e embaralhava a ordem dos filhos na relação do pai. ~430 páginas levam ~6–7 min e a requisição só responde no final; o Fastify roda sem timeout de conexão/requisição, e o cliente também não pode ter.

## Banco de dados (PostgreSQL + Prisma)

- Postgres 17 local via Docker (`docker-compose.yml` na raiz): `pnpm db:up` / `pnpm db:down` / `pnpm db:logs`.
- Variáveis no `.env` da raiz, separadas (sem `DATABASE_URL`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `POSTGRES_PORT` (padrão `5432`). O docker-compose e a API usam as mesmas; a URL do Prisma CLI é montada em `prisma.config.ts`.
- Prisma 7 em `apps/api/prisma/` (`schema.prisma`, `migrations/`) com `prisma.config.ts` e driver adapter `pg`. O client é gerado em `apps/api/src/generated/prisma` (ignorado no git; `pnpm --filter=@notion-automation/api db:generate`, também roda no `postinstall`).
- Client único em `apps/api/src/db/prisma.ts`; a conexão fecha no hook `onClose` do `server.ts`.
- Comandos (em `apps/api`): `db:migrate` (cria/aplica migration em dev), `db:deploy`, `db:studio`.
- Tabelas (uma migration cada), ambas com `id`, `response` (JSON) e `created_at`:
  - `log_create_year`: resposta de sucesso (201 e 200 do `repair`) de `POST /createYear`.
  - `log_deleted_year`: resposta de sucesso de `DELETE /deleteYear`.
- A gravação do log acontece depois da operação no Notion; se o insert falhar, o erro só é logado e a resposta da rota não muda.

## A preencher

- [x] Como os níveis se relacionam (propriedades de relação no Notion) — ver tabela acima
- [x] Estratégia para evitar duplicatas (ano já existe?) — consulta por `Name` no database de anos
- [ ] Papel do app `web`
