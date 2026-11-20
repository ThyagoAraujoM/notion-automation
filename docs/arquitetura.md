# Arquitetura

> Como o sistema é organizado. Atualize sempre que surgir um módulo novo ou o fluxo mudar.

## Objetivo

Gerar automaticamente, no Notion, a hierarquia de planejamento:

```
Ano ─┬─ Trimestre (4) ─┬─ Mês (3 por trimestre) ─┬─ Semana ─┬─ Dia
     │                 │                          │          │
  YEAR_DATABASE_ID     QUARTER_DATABASE_ID           MONTH_DATABASE_ID  WEEK_DATABASE_ID  DAY_DATABASE_ID
```

Cada nível vive em um **database próprio do Notion**. As variáveis `*_DATABASE_ID` são os IDs desses databases
(usados em `parent.database_id`). Os níveis são ligados entre si por propriedades de relação (tabela em [Rotina anual](#rotina-anual-post-years)).

## Monorepo

| Pacote                                                 | Papel                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/api`                                             | API Fastify que fala com o Notion                                        |
| `apps/web`                                             | Landing page do projeto (Next.js 16 App Router + Tailwind 4 + shadcn/ui) |
| `packages/env`                                         | Schema Zod + validação das variáveis de ambiente                         |
| `packages/eslint-config`, `packages/typescript-config` | Configs compartilhadas                                                   |

## Fluxo de uma requisição (API)

```
HTTP ─▶ src/http/server.ts (listen) ─▶ src/http/app.ts (buildApp) ─▶ src/http/routes/<recurso>/<rota>.ts ─▶ src/services/<caso-de-uso>.ts ─▶ src/integrations/notion/client.ts ─▶ Notion API
          (registra plugins)    (valida com Zod, responde)    (regra de negócio)          (cliente singleton)
```

- **`src/http/app.ts`**: `buildApp()` monta o Fastify (error handler, Swagger, rotas) sem abrir porta nem tocar no banco; usado pelo `server.ts` e pelos testes (`app.inject`). O `server.ts` só adiciona o fechamento do Prisma, limpa as travas, marca como falhos os jobs interrompidos e chama `listen`.
- **Rotas** (`src/http/routes/<recurso>/`): só HTTP — schema Zod, status code, formato da resposta. Uma pasta por recurso REST (`years/`, `databases/`) com `index.ts` registrando as rotas do recurso.
  - **`src/http/schemas/common.ts`**: schemas Zod repetidos (`errorResponse`, `yearParams`, `flagSchema`, `levelCounts`, `yearOperation`, `jobAccepted`).
  - **`src/http/errors.ts`**: `toHttpError` traduz erros de domínio em 400/404/409/422/504, limitado aos status que a rota declara.
  - **`src/http/year-job.ts`**: `startYearJob` (trava, grava o job e roda a operação em segundo plano), `failureOutcome`, `acceptedBody` e `settleYearJobs` (testes). Ver [Operações em segundo plano](#operações-em-segundo-plano-jobs).
- **services** (`src/services/`): casos de uso (regra de negócio). Não conhece Fastify.
  - **`services/shared/`**: peças reutilizadas por mais de um caso de uso e que fazem I/O no Notion — `errors.ts` (`YearNotFoundError`, `YearAlreadyExistsError`), `year-pages.ts` (propriedades de cada nível, `createPage`, `prepareTemplates`, `trashPages`) e `year-hierarchy.ts` (`queryChildrenOf`, `collectYearHierarchy`: trimestres → meses → semanas → dias de um ano). Se duas funções de `services/` precisam do mesmo código, ele vai para cá.
- **utils** (`src/utils/`): lógica pura, sem I/O (`routine-calendar.ts` = calendário, com testes em `routine-calendar.test.ts`; `notion-pages.ts` = `normId`, `uniqueById`, `indexBy`, `matchNumber`).
- **scripts** (`src/scripts/`): programas de linha de comando, fora da API (hoje: `e2e-routine.ts`, ver [convencoes.md](./convencoes.md#testes)). Chamam os services direto.
- **integrations** (`src/integrations/notion/`): cliente e helpers do Notion.
- **db** (`src/db/`): client Prisma, trava por ano (`year-lock.ts`), jobs (`year-job.ts`) e log de operações (`operation-log.ts`).
- **env** (`@notion-automation/env`): única porta de entrada para `process.env`.

## Portas

| App | Variável        | Padrão |
| --- | --------------- | ------ |
| API | `PORT_BACKEND`  | 4000   |
| Web | `PORT_FRONTEND` | 3000   |

Ambos carregam o `.env` da raiz via `dotenv -e ../../.env`.

## Rotas existentes

| Método | Rota                            | Arquivo                                   | O que faz                                                                                                               |
| ------ | ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/years`                        | `routes/years/create-year.ts`             | Cria a rotina anual (Ano → Dias) em segundo plano. Body `{ year?, startToday? }`; **202** + `jobId`                     |
| POST   | `/years/:year/repair`           | `routes/years/repair-year.ts`             | Repara um ano existente (cria o que falta, religa pais errados) em segundo plano. Body `{ startToday? }`; **202**       |
| DELETE | `/years/:year`                  | `routes/years/delete-year.ts`             | Manda para a lixeira do Notion o ano e todos os trimestres, meses, semanas e dias, em segundo plano; **202**            |
| GET    | `/years/jobs/:jobId`            | `routes/years/get-year-job.ts`            | Situação de um job: `running`/`succeeded`/`failed`, `statusCode` e `result` que a operação daria; 404 se não existir    |
| GET    | `/databases/:databaseId/schema` | `routes/databases/get-database-schema.ts` | Lista data sources e propriedades (id, nome, tipo + destino das relações) de um database; 404 se não existir/sem acesso |
| GET    | `/docs` (+ `/docs/json`)        | `app.ts` (`@fastify/swagger-ui`)          | Swagger UI / spec OpenAPI gerada dos schemas Zod                                                                        |

Parâmetros por rota (antes tudo ficava em `POST /createYear` e `DELETE /deleteYear?year=`; ver decisão 009):

| Parâmetro    | `POST /years`                    | `POST /years/:year/repair`                    | `DELETE /years/:year` |
| ------------ | -------------------------------- | --------------------------------------------- | --------------------- |
| `year`       | body, opcional (ano atual)       | path, obrigatório                             | path, obrigatório     |
| `startToday` | body, opcional                   | body, opcional (confere só de hoje em diante) | —                     |
| `repair`     | removido: virou a rota `/repair` | —                                             | —                     |

> Swagger: `@fastify/swagger` deve ser registrado **antes** das rotas em `app.ts`. Para uma rota aparecer
> numa seção do docs, use `tags` no schema; a ordem das seções segue `openapi.tags`.

## Rotina anual (`POST /years`)

Body opcional `{ "year": 2027, "startToday": 0 }` (sem `year` → ano atual). Código: `routes/years/create-year.ts` → `services/create-year.ts` (reparo: `routes/years/repair-year.ts` → `services/repair-year.ts`) → `utils/routine-calendar.ts` (calendário puro) e `integrations/notion/helpers.ts` (consultas e propriedades).

Fluxo: (1) resolve o ano → (2) consulta o database de anos pelo `Name`; se existir, **409** →
(3) `buildYearPlan` calcula trimestres/meses/semanas/dias → (4) busca os templates de cada database e valida que existem (senão **422**, sem criar nada) →
(5–9) cria Ano → Trimestres → Meses → Semanas → Dias, sempre guardando o id do pai para a relação do filho.
Resultado do job: **201** com a contagem do que foi criado (os 409 e 422 acima também saem no job, não no 202).

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
Se o ano já existir, o job de `POST /years` termina com 409 (use o reparo).

**Reparo (`POST /years/:year/repair`):** **repara** o ano do path (`services/repair-year.ts`); aceita `startToday` no body.
O ano precisa existir (senão **404**). Fluxo: busca os trimestres ligados ao ano → os meses ligados a eles → as semanas
ligadas aos meses; os **dias** são buscados pela propriedade `Data` (dentro do ano). Cada item do calendário é casado por
número (`Número do Trimestre`, `Nº do mês`, `Semana nº`) ou data, com fallback no nome. O que falta é **criado e vinculado**;
o que existe mas está ligado ao pai errado (ou a mais de um pai) é **religado** ao pai correto. Nomes e números de páginas
existentes não são alterados. Resultado do job: **200** com `created` e `relinked` (contagens).
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
- **Timeout por chamada ao Notion:** o client tem `timeoutMs` de 60 s (`NOTION_TIMEOUT_MS` em `integrations/notion/client.ts`). Se uma chamada estourar, `isNotionTimeout` identifica o erro e o job termina com **504** ("o Notion está demorando para responder"). No `createYear` o rollback ainda roda (páginas já criadas vão para a lixeira; uma página cuja criação deu timeout pode ter sido criada sem a gente saber — use `repair`); `repair` e `deleteYear` são idempotentes, basta repetir.
- **Tempo estimado** (documentado no Swagger de cada rota): ano completo ~6–7 min para criar, ~3–4 min para apagar; `startToday` proporcional ao que falta (~1 s/página). Medido no E2E (2090): criar 110 páginas ≈ 1 min, reparar 38 ≈ 30 s, apagar 147 ≈ 1 min.
- Criação **uma página por vez** (`mapSequential`): com template + relação, criar em paralelo fez o Notion mandar páginas para a lixeira (ver decisão 006) e embaralhava a ordem dos filhos na relação do pai. ~430 páginas levam ~6–7 min; por isso a operação roda em segundo plano (ver abaixo) e a requisição responde 202 na hora.

## Operações em segundo plano (jobs)

`POST /years`, `POST /years/:year/repair` e `DELETE /years/:year` levam de 1 a 7 min. Para o cliente não ficar com a conexão aberta esse tempo todo (proxies e clientes HTTP cortam), elas **respondem 202 na hora** e rodam em segundo plano, no próprio processo da API (decisão 017, `PF-001`).

```
cliente ── POST /years ──▶ rota: valida (Zod + startToday) ─▶ trava o ano ─▶ grava year_job (running) ─▶ dispara o service SEM await ─▶ 202 { jobId, statusUrl } + Location
                                                                                                                │
                                              (event loop do Node, enquanto a API atende outras requisições)   ▼
                                                                         service termina/falha ─▶ year_job (succeeded|failed, statusCode, result) ─▶ operation_log ─▶ solta a trava
cliente ── GET /years/jobs/:jobId (polling a cada 5–10 s) ──▶ lê year_job ─▶ 200 { status, statusCode, result }
```

- **Runner:** `startYearJob` (`src/http/year-job.ts`). Cada rota passa o `run` (chamada ao service) e o `toOutcome`, que converte o resultado ou o erro no **código e corpo que a rota síncrona daria** (`failureOutcome` usa o mesmo `toHttpError`). Esses valores vão para `year_job.status_code`/`result` e para o `operation_log`.
- **O que continua síncrono** (resposta direta, sem job): 400 do Zod, 400 de `startToday` fora do ano atual (a rota chama `buildPlan`, que é puro, antes de aceitar) e 409 de operação em andamento (a trava é obtida antes do 202). Falha ao gravar o job → 500 e a trava é solta.
- **O que vai para o job:** tudo que depende do Notion — 409 "ano já existe", 404 "ano não existe", 422 templates, 504 timeout e 500 inesperado (a mensagem interna fica só em `year_job.error` e `operation_log.error`).
- **Nunca derruba o processo:** a promise do job termina num `.catch` que só loga; falha ao gravar o job ou o log não impede soltar a trava (`finally`).
- **API reiniciou no meio** (deploy, crash, `tsx watch`): a operação para onde estava. Ao subir, `failInterruptedYearJobs` marca os jobs `running` como `failed` (500, mensagem sugerindo `repair` ou `DELETE`), junto com `clearYearLocks`. Só funciona porque há **uma instância** da API.
- **Testes:** `settleYearJobs()` espera os jobs em andamento terminarem, sem `setTimeout` (ver [convencoes.md](./convencoes.md#testes)).

## Banco de dados (PostgreSQL + Prisma)

- Postgres 17 local via Docker (`docker-compose.yml` na raiz): `pnpm db:up` / `pnpm db:down` / `pnpm db:logs`.
- Variáveis no `.env` da raiz, separadas (sem `DATABASE_URL`): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST` (padrão `localhost`) e `POSTGRES_PORT` (padrão `5432`). O docker-compose usa usuário, senha, banco e porta; a API (`db/prisma.ts`) e a URL do Prisma CLI (`prisma.config.ts`) usam também o host, o que permite apontar para um Postgres fora da máquina.
- Prisma 7 em `apps/api/prisma/` (`schema.prisma`, `migrations/`) com `prisma.config.ts` e driver adapter `pg`. O client é gerado em `apps/api/src/generated/prisma` (ignorado no git; `pnpm --filter=@notion-automation/api db:generate`, também roda no `postinstall`).
- Client único em `apps/api/src/db/prisma.ts`; a conexão fecha no hook `onClose` do `server.ts`.
- Comandos (em `apps/api`): `db:migrate` (cria/aplica migration em dev), `db:deploy`, `db:studio`.
- Tabelas:
  - `operation_log`: **uma linha por requisição** de `/years` que chega ao handler, com sucesso ou erro. Colunas: `year`, `operation` (enum `createYear` | `repairYear` | `deleteYear`), `status` (enum `success` | `error`), `status_code`, `response` (JSON enviado ao cliente), `error` (mensagem interna; em 500 é o único lugar onde ela aparece), `started_at`, `finished_at` e `duration_ms`. Índice em `(year, started_at)`. Substituiu `log_create_year` e `log_deleted_year` (dados copiados na migration `20261120210000_operation_log`; nas linhas migradas `duration_ms` é nulo).
  - `year_job`: **um job por operação aceita** (202). Colunas: `id` (uuid, o `jobId`), `year`, `operation`, `status` (enum `JobStatus`: `running` | `succeeded` | `failed`), `params` (JSON do pedido), `status_code` e `result` (código e corpo que a rota síncrona daria; nulos enquanto roda), `error` (mensagem interna), `created_at`, `finished_at`. Índice em `(year, created_at)`. Acesso em `src/db/year-job.ts`; nunca é limpa automaticamente.
  - `year_operation_lock`: **trava por ano** (`year` é a chave primária, `operation`, `started_at`). Ver abaixo.
- Gravação: cada rota chama `startOperationLog(request, year, operation)` (`src/http/operation-log.ts`) no início; o `log(statusCode, response, error?)` devolvido é chamado no 400/409 síncrono ou, quando a operação é aceita, **no fim do job**, com o código final e a duração total (o 202 em si não grava linha). Erro de validação do Zod (400 antes do handler) não grava. Se o insert falhar, o erro só vai para o log da API e a resposta não muda.
- Consultar: `pnpm --filter=@notion-automation/api db:studio` ou SQL, ex.: `select year, operation, status, status_code, duration_ms, error from operation_log order by id desc limit 20;`.

### Trava de operação por ano

`createYear`, `repairYear` e `deleteYear` só rodam com o ano travado: `acquireYearLock(year, operation)` (`services/shared/year-lock.ts`, chamado pelo `startYearJob`) insere o ano em `year_operation_lock` **antes do 202** e devolve o `release`, que o job chama no fim (`finally`), em qualquer desfecho. Se já houver uma linha para aquele ano, a operação **não executa** e a rota responde **409** na hora ("já existe uma operação em andamento"). Anos diferentes rodam em paralelo.

- A chave primária faz o próprio banco recusar a segunda tentativa, sem corrida entre "checar" e "gravar".
- Trava presa (processo morreu no meio): ao subir, a API limpa todas as travas (`clearYearLocks`, só há uma instância); além disso, uma trava com mais de 1 h (`YEAR_LOCK_TTL_MS`) é descartada ao tentar travar.
- Só as rotas travam; o script E2E chama os services direto e por isso não precisa do Postgres.
- Se o Postgres estiver fora, travar falha e a rota responde 500 (antes, só o log falhava).

## A preencher

- [x] Como os níveis se relacionam (propriedades de relação no Notion) — ver tabela acima
- [x] Estratégia para evitar duplicatas (ano já existe?) — consulta por `Name` no database de anos
- [x] Papel do app `web` — landing page que explica o projeto (`app/(home)/`)
