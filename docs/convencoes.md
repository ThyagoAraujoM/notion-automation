# Convenções

> Padrões de código e nomes. Se o Claude errar algo repetidamente, a regra provavelmente falta aqui.

## Geral

- TypeScript em tudo. Evite `any`.
- Formatação: Prettier (`pnpm format`). Lint: ESLint 9 (`pnpm lint`).
- Pacotes internos: escopo `@notion-automation/*`, referenciados como `workspace:*`.
- Na API, use o alias `@/*` → `apps/api/src/*` para imports internos.

## Nomes

| O quê                                                    | Padrão                        | Exemplo                                      |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| Pasta de rotas                                           | recurso no plural, kebab-case | `routes/years/`                              |
| Arquivo de rota                                          | kebab-case, verbo + recurso   | `routes/years/create-year.ts`                |
| Função plugin da rota                                    | camelCase + `Route`           | `export async function createYearRoute(app)` |
| Caminho HTTP                                             | REST: recurso no plural + id  | `POST /years`, `DELETE /years/:year`         |
| Arquivo em `services/`, `utils/`, `db/`, `integrations/` | kebab-case                    | `services/create-year.ts`                    |
| Variável de ambiente                                     | SCREAMING_SNAKE_CASE          | `PORT_BACKEND`                               |

## Ao terminar uma tarefa (portão de qualidade)

- **Quem roda:** quem altera código — os subagentes `executor` e `rapido` e a sessão principal quando edita arquivos. Quem só lê (`explorador`, `revisor`) não roda.
- **O quê:** na raiz, `pnpm lint && pnpm check-types && pnpm test`. Os três passam pelo Turbo e cobrem `apps/api`, `apps/web` e `packages/env`. Relate o resultado (passou / o que falhou).
- **Pacote novo** no monorepo precisa dos scripts `lint` e `check-types` (e `test`, se tiver testes); sem eles o Turbo **pula o pacote sem avisar**. Confira com `pnpm turbo run lint check-types --dry` (nenhuma tarefa pode aparecer como `<NONEXISTENT>` num pacote com código).
- **Docs e skills vivas:** se a tarefa mudou um padrão (estrutura de rota, convenção, comando, variável), atualize no mesmo commit a doc e a skill que o descrevem (`docs/`, `.claude/skills/`, `.claude/agents/`, `CLAUDE.md`).

## Rotas (Fastify)

- Caminhos **REST**: recurso no plural, identificador no path e ações que não são CRUD como sub-recurso (`POST /years`, `POST /years/:year/repair`, `DELETE /years/:year`). O verbo HTTP diz a ação; não repita no caminho (nada de `/createYear`).
- Cada recurso tem uma pasta em `src/http/routes/<recurso>/` com um arquivo por rota e um `index.ts` que registra todas (`yearsRoutes`). O `buildApp` (`src/http/app.ts`) registra o plugin do recurso; o `server.ts` só chama `buildApp()` e `listen`.
- Schemas Zod repetidos (`errorResponse`, `yearParams`, `flagSchema`, `levelCounts`) ficam em `src/http/schemas/common.ts`.
- Erros de domínio viram status HTTP em `src/http/errors.ts` (`toHttpError(error, [statuses da rota], mensagem do 504)`). A lista de statuses é tipada contra o `response` da rota: o TypeScript não deixa responder um status que a rota não declara.
- Use `app.withTypeProvider<ZodTypeProvider>()` e declare `body`/`params`/`response` em `schema`.
- Sem regra de negócio na rota: delegue para `src/services/`.
- **Descrição das rotas no Swagger:** `description` é uma lista em markdown, um item por linha (`[...].join("\n")`), nunca um texto corrido. Padrão:
  - Seção `**Parâmetros**` com um item por parâmetro: ``- **`parametro`**: descrição do parâmetro.``
  - Seção `**Respostas**` com um item por status: ``- **`409`**: quando acontece.``
  - Avisos importantes em linha própria (`**Atenção**: ...`).
  - Além disso, descreva cada campo do `body`/`params`/`query` com `.describe("...")` no Zod.
  - Exemplo: `routes/years/create-year.ts`.
- Erros: responda com status coerente (4xx/5xx) e `success: false`. Nunca `200` em caso de erro.

## Variáveis de ambiente

- Nunca acesse `process.env` direto; importe `env` de `@notion-automation/env`.
- Variável nova → adicione em **`server`** e em **`runtimeEnv`** de `packages/env/index.ts`.
- Nunca leia, exiba ou commite o `.env`.

## Commits

- Conventional Commits em português: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Exemplo: `feat: cria trimestres ao gerar o ano`.
- **Branch por demanda** (`<tipo>/<slug>`, mesmo slug de `docs/workflows/<slug>/`); nunca commit direto na `main`.
- **Na branch: um commit por incremento** do `technical-plan.md`, cada um com o portão verde (`pnpm lint && pnpm check-types && pnpm test`).
- **Na `main`: um commit por pedido**, via PR com **squash merge**. O título do PR (Conventional Commit) vira esse commit.
- Problema encontrado fora do escopo não entra no diff: vira `PF-NNN` em `docs/pendencias.md`.
- Push, PR e merge só quando o usuário pedir (skill `pr`, por `/pr`).
- Regras completas em `.claude/rules/git-workflow.md`; passo a passo nas skills `feature`, `bugfix`, `revisar` e `pr`.

## Testes

### Unitários (Vitest)

`pnpm test` (raiz, via Turbo) ou `pnpm --filter=@notion-automation/api test` / `test:watch`.

- Config em `apps/api/vitest.config.mts`: alias `@/*` igual ao tsconfig e `test.env` com valores falsos para o `@notion-automation/env` validar ao ser importado. Arquivos `*.test.ts` **ao lado** do código testado.
- Nunca falam com a rede nem com o banco: rodam em ~2 s e são o que deixa a IA iterar com segurança. Lógica nova em `utils/` vem com teste; rota nova vem com teste de rota.
- O que existe hoje:
  - `utils/routine-calendar.test.ts`, `utils/notion-pages.test.ts`: lógica pura.
  - `integrations/notion/helpers.test.ts`: leitura de propriedades, `mapSequential`/`mapPool`, mensagens de template faltando e `loadTemplates` com o client do Notion mockado (inclui paginação).
  - `services/shared/year-pages.test.ts`: nomes exatos das colunas de cada nível (contrato com o Notion).
  - `http/routes/<recurso>/*.test.ts`: cada rota via `app.inject()`, com status, validação e tradução de erros.
  - `http/app.test.ts`: o OpenAPI gerado (`/docs/json`): rotas, tags, body e status declarados.
- Data atual: use `vi.useFakeTimers()` + `vi.setSystemTime(...)` e `vi.useRealTimers()` no `afterEach`.
- **Testar rota:** `const app = buildApp({ logger: false })`, `beforeAll(() => app.ready())`, `afterAll(() => app.close())` e `app.inject({ method, url, payload })`. Mocke os services (`vi.mock("@/services/create-year", () => ({ createYear: vi.fn() }))`), o log (`@/db/operation-log`, com `saveOperationLog: vi.fn()`) e a trava (`@/services/shared/year-lock`, com `withYearLock` chamando `fn()`). Exemplo: `http/routes/years/years.test.ts`.
- **Mockar o Notion:** `vi.mock("./client", () => ({ notion: { ... só os métodos usados: vi.fn() } }))` e `vi.mocked(notion.x.y).mockImplementation(...)`. Erros do client: `new RequestTimeoutError()` (504) e `new APIResponseError({ code, status, message, headers: new Headers(), rawBodyText: "", additional_data: undefined, request_id: undefined })`.
- **Prisma:** nunca é chamado nos testes; mocke o módulo de `db/` que a rota usa.
- Services (`create-year`, `repair-year`, `delete-year`) e a trava real (`withYearLock` + Postgres) ainda não têm teste unitário; a orquestração dos services é coberta pelo E2E. Todo teste que usa `buildApp` mocka `@/db/operation-log` e `@/services/shared/year-lock`, mesmo sem chamar rotas de `/years`.

### E2E no Notion real

`pnpm --filter=@notion-automation/api test:e2e [-- --year=2090] [--keep]` (código em `apps/api/src/scripts/e2e-routine.ts`).

- Roda `createYear` (out–dez) → `repair` (set–dez, precisa criar Setembro e o T3) → `deleteYear` num ano avulso (padrão **2090**) e confere o Notion lendo-o de volta (nomes, números, pais, contagens). Cada etapa imprime trimestre → mês → semanas → dias.
- Chama os **services** direto: não precisa da API no ar nem do Postgres. O recorte "a partir de uma data" usa a opção interna `from` dos services (`PlanFrom`), que a rota não expõe.
- Escreve no workspace **real** (e apaga no fim). Por segurança só aceita anos `>= ano atual + 10`, aborta se o ano já existir e só apaga o que ele criou. `--keep` deixa o ano no Notion para depuração.
- Sai com código 1 se algo falhar. Rode depois de mexer em `services/`, `integrations/notion/` ou `utils/routine-calendar.ts`.
