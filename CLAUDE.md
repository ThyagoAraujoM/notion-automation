# CLAUDE.md

API que gera no Notion a rotina de planejamento **Ano → Trimestres → Meses → Semanas → Dias**, cada nível em um database próprio.
Monorepo Turborepo + pnpm: `apps/api` (Fastify 5 + Zod 4 + `@notionhq/client` v5 + Prisma 7), `apps/web` (Next.js 16 + Tailwind 4 + shadcn/ui, landing page do projeto), `packages/env` (validação do `.env`).

## Leia quando precisar

- [docs/arquitetura.md](docs/arquitetura.md) — módulos, fluxo de requisição, rotas existentes
- [docs/convencoes.md](docs/convencoes.md) — padrões de código, nomes, testes, commits
- [docs/decisoes.md](docs/decisoes.md) — por que escolhemos X e não Y
- [docs/workflows/](docs/workflows/README.md) — demandas (spec, plano, review) e o fluxo das skills de workflow
- [docs/pendencias.md](docs/pendencias.md) — problemas e melhorias conhecidos (`PF-NNN`)

## Nomenclatura das páginas criadas no Notion

| Nível     | Padrão                             | Exemplo                                                   |
| --------- | ---------------------------------- | --------------------------------------------------------- |
| Ano       | Ano completo                       | `2026`                                                    |
| Trimestre | `T` + número                       | `T1`, `T2`, `T3`, `T4`                                    |
| Mês       | Nome do mês em português           | `Janeiro`, `Fevereiro`...                                 |
| Semana    | `Semana` + número crescente no ano | `Semana 1`, `Semana 2`... (até `Semana 54` em 2040)       |
| Dia       | Dia da semana (com `" - Feira"`)   | `Segunda - Feira`, `Terça - Feira`... `Sábado`, `Domingo` |

Detalhes (propriedades preenchidas, semanas, `Dia Nº`) em [docs/arquitetura.md](docs/arquitetura.md#rotina-anual-post-years).

## Comandos (na raiz)

```sh
pnpm dev                                    # todos os apps (API :4000, Web :3000)
pnpm dev --filter=@notion-automation/api    # só a API
pnpm --filter=@notion-automation/api build  # gera apps/api/dist/server.js (tsup); start:local roda com o .env, start usa o ambiente
pnpm lint && pnpm check-types && pnpm test  # portão de qualidade (ver "Ao terminar uma tarefa")
pnpm format
pnpm db:up                                  # sobe o Postgres (Docker); db:down / db:logs
pnpm --filter=@notion-automation/api db:migrate   # nova migration em dev
pnpm --filter=@notion-automation/api test:watch   # Vitest em modo watch
pnpm --filter=@notion-automation/api test:e2e     # create → repair → delete num ano avulso (2090), ~5 min, no Notion real
```

## Ao terminar uma tarefa

- Quem **altera código** (o `executor`, o `rapido` e a sessão principal quando edita) roda `pnpm lint && pnpm check-types && pnpm test` na raiz antes de dar a tarefa por concluída e relata o resultado. Quem só lê (`explorador`, `revisor`) não roda.
- Pacote novo no monorepo precisa dos scripts `lint` e `check-types` (senão o Turbo o pula sem avisar). Confira com `pnpm turbo run lint check-types --dry`.
- O **CI** (`.github/workflows/ci.yml`) roda o mesmo portão + `pnpm build` em todo PR; mudou um comando do portão, atualize o workflow junto.
- **Docs e skills vivas:** se a tarefa mudou um padrão (estrutura de rota, convenção, comando, variável), atualize no **mesmo commit** a doc e a skill que o descrevem (`docs/`, `.claude/skills/`, `.claude/agents/`, este arquivo).

## Regras essenciais

- **Nunca** leia, exiba ou commite o `.env`.
- `process.env` só via `@notion-automation/env` (o lint falha se não for); variável nova vai em `server` **e** `runtimeEnv` de `packages/env/index.ts`, em `globalEnv` do `turbo.json` **e** no `.env.example` (o teste `env-consistency` confere). Use a skill `nova-variavel-env`. Mudança no banco: skill `nova-migration`.
- Um hook `PreToolUse` (`.claude/hooks/guard.mjs`) bloqueia `git commit` na `main` e a leitura do `.env` por shell; é uma rede de segurança por regex (também barra comandos que só citam o arquivo).
- As variáveis `*_DATABASE_ID` são os IDs dos databases de cada nível (`YEAR_`, `QUARTER_`, `MONTH_`, `WEEK_`, `DAY_`); `NOTION_TOKEN` é o único token.
- Rotas REST por recurso: plugin em `apps/api/src/http/routes/<recurso>/`, registrado no `buildApp` (`src/http/app.ts`) e com teste via `app.inject()` ao lado. Regra de negócio fica em `apps/api/src/services/` (integrações em `integrations/`, banco em `db/`, lógica pura em `utils/`). Para criar rota, use a skill `criar-endpoint`.
- Descrição de rota no Swagger: lista markdown, um parâmetro por linha (``- **`param`**: descrição``) + `.describe()` nos campos Zod. Padrão em [docs/convencoes.md](docs/convencoes.md#rotas-fastify).
- Lógica pura nova (em `utils/`) vem com teste unitário ao lado (`*.test.ts`, Vitest).
- Commits: Conventional Commits em português (`feat:`, `fix:`, `chore:`...).
- **Branch por demanda, merge commit na `main`.** Nunca commite direto na `main`: cada pedido tem uma branch `<tipo>/<slug>` com um commit por incremento (portão verde, mensagem clara) e entra na `main` por PR com **merge commit**, que mantém cada commit da branch rastreável (um pedido = um merge). Push e PR só quando pedido (`/pr`). Regras em `.claude/rules/git-workflow.md`; detalhes em [docs/convencoes.md](docs/convencoes.md#commits).

## Workflows (skills)

Pedido de código segue: `spec-authoring` → `feature` ou `bugfix` → `revisar` → `/pr` (só o usuário dispara). Artefatos em `docs/workflows/<slug>/`. Problema fora do escopo → `docs/pendencias.md` (rule `pending-fixes`). Visão geral em [docs/workflows/README.md](docs/workflows/README.md).

## Fluxo de trabalho com modelos

- **Principal (executor): Sonnet**, com **advisor Opus** para decisões difíceis (`.claude/settings.json`).
- Busca no código → subagente `explorador` (Haiku). Tarefas pequenas e mecânicas → `rapido` (Haiku). Implementação planejada → `executor` (Sonnet). Revisão antes do PR → skill `revisar` (usa o subagente `revisor`, Sonnet).
- Para planejar algo grande: use plan mode e peça explicitamente para consultar o advisor.

## Pontos de atenção conhecidos

- A API precisa do Postgres no ar (`pnpm db:up`) e das variáveis `POSTGRES_*` no `.env`; as rotas de `/years` gravam cada requisição (sucesso ou erro) em `operation_log` e usam uma trava por ano (`year_operation_lock`); rode `pnpm --filter=@notion-automation/api db:deploy` para aplicar as migrations.
- Anos bissextos que começam no domingo (2040, 2068, 2096) têm **54 semanas**: o database de semanas precisa do template `Semana 54`, senão a criação responde 422.
