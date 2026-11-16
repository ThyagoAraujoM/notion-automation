# CLAUDE.md

API que gera no Notion a rotina de planejamento **Ano → Trimestres → Meses → Semanas → Dias**, cada nível em um database próprio.
Monorepo Turborepo + pnpm: `apps/api` (Fastify 5 + Zod 4 + `@notionhq/client` v5), `apps/web` (Next.js 16, ainda template), `packages/env` (validação do `.env`).

## Leia quando precisar

- [docs/arquitetura.md](docs/arquitetura.md) — módulos, fluxo de requisição, rotas existentes
- [docs/convencoes.md](docs/convencoes.md) — padrões de código, nomes, commits
- [docs/decisoes.md](docs/decisoes.md) — por que escolhemos X e não Y

## Nomenclatura das páginas criadas no Notion

| Nível     | Padrão                             | Exemplo                                                   |
| --------- | ---------------------------------- | --------------------------------------------------------- |
| Ano       | Ano completo                       | `2026`                                                    |
| Trimestre | `T` + número                       | `T1`, `T2`, `T3`, `T4`                                    |
| Mês       | Nome do mês em português           | `Janeiro`, `Fevereiro`...                                 |
| Semana    | `Semana` + número crescente no ano | `Semana 1`, `Semana 2`...                                 |
| Dia       | Dia da semana (com `" - Feira"`)   | `Segunda - Feira`, `Terça - Feira`... `Sábado`, `Domingo` |

Detalhes (propriedades preenchidas, semanas, `Dia Nº`) em [docs/arquitetura.md](docs/arquitetura.md#rotina-anual-post-createyear).

## Comandos (na raiz)

```sh
pnpm dev                                    # todos os apps (API :4000, Web :3000)
pnpm dev --filter=@notion-automation/api    # só a API
pnpm lint && pnpm check-types               # rode antes de dar uma tarefa por concluída
pnpm format
pnpm db:up                                  # sobe o Postgres (Docker); db:down / db:logs
pnpm --filter=@notion-automation/api db:migrate   # nova migration em dev
```

Ainda não há testes.

## Regras essenciais

- **Nunca** leia, exiba ou commite o `.env`.
- `process.env` só via `@notion-automation/env`; variável nova vai em `server` **e** `runtimeEnv` de `packages/env/index.ts`.
- As variáveis `*_TOKEN` de período são **IDs de database** do Notion, não tokens.
- Rota = plugin em `apps/api/src/http/routes/`, registrada em `server.ts`. Regra de negócio fica em `apps/api/src/lib/`. Para criar rota, use a skill `criar-endpoint`.
- Descrição de rota no Swagger: lista markdown, um parâmetro por linha (``- **`param`**: descrição``) + `.describe()` nos campos Zod. Padrão em [docs/convencoes.md](docs/convencoes.md#rotas-fastify).
- Commits: Conventional Commits em português (`feat:`, `fix:`, `chore:`...).
- **Commit só no final.** Não commite etapa por etapa: o commit vem **uma vez**, quando **todas as etapas** do pedido (a feature/funcionalidade) terminarem, com lint/tipos ok. Cada pedido concluído = um commit. Se pedidos diferentes ficarem misturados, separe-os em commits distintos (stage parcial). Push só quando pedido. Detalhes em [docs/convencoes.md](docs/convencoes.md#commits).

## Fluxo de trabalho com modelos

- **Principal (executor): Sonnet**, com **advisor Opus** para decisões difíceis (`.claude/settings.json`).
- Busca no código → subagente `explorador` (Haiku). Tarefas pequenas e mecânicas → `rapido` (Haiku). Implementação planejada → `executor` (Sonnet). Antes de commitar → `/revisar` (`revisor`, Sonnet).
- Para planejar algo grande: use plan mode e peça explicitamente para consultar o advisor.

## Pontos de atenção conhecidos

- `apps/api/package.json`: `main` aponta para `server.tsx`, mas o arquivo é `server.ts`.
- A API precisa do Postgres no ar (`pnpm db:up`) e de `DATABASE_URL` no `.env`; as rotas createYear/deleteYear gravam log no banco.
