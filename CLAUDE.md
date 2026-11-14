# CLAUDE.md

API que gera no Notion a rotina de planejamento **Ano → Trimestres → Meses → Semanas → Dias**, cada nível em um database próprio.
Monorepo Turborepo + pnpm: `apps/api` (Fastify 5 + Zod 4 + `@notionhq/client` v5), `apps/web` (Next.js 16, ainda template), `packages/env` (validação do `.env`).

## Leia quando precisar

- [docs/arquitetura.md](docs/arquitetura.md) — módulos, fluxo de requisição, rotas existentes
- [docs/convencoes.md](docs/convencoes.md) — padrões de código, nomes, commits
- [docs/decisoes.md](docs/decisoes.md) — por que escolhemos X e não Y

## Comandos (na raiz)

```sh
pnpm dev                                    # todos os apps (API :4000, Web :3000)
pnpm dev --filter=@notion-automation/api    # só a API
pnpm lint && pnpm check-types               # rode antes de dar uma tarefa por concluída
pnpm format
```

Ainda não há testes.

## Regras essenciais

- **Nunca** leia, exiba ou commite o `.env`.
- `process.env` só via `@notion-automation/env`; variável nova vai em `server` **e** `runtimeEnv` de `packages/env/index.ts`.
- As variáveis `*_TOKEN` de período são **IDs de database** do Notion, não tokens.
- Rota = plugin em `apps/api/src/http/routes/`, registrada em `server.ts`. Regra de negócio fica em `apps/api/src/lib/`. Para criar rota, use a skill `criar-endpoint`.
- Commits: Conventional Commits em português (`feat:`, `fix:`, `chore:`...). Só commite quando pedido.

## Fluxo de trabalho com modelos

- **Principal (executor): Sonnet**, com **advisor Opus** para decisões difíceis (`.claude/settings.json`).
- Busca no código → subagente `explorador` (Haiku). Tarefas pequenas e mecânicas → `rapido` (Haiku). Implementação planejada → `executor` (Sonnet). Antes de commitar → `/revisar` (`revisor`, Sonnet).
- Para planejar algo grande: use plan mode e peça explicitamente para consultar o advisor.

## Pontos de atenção conhecidos

- `new-year.ts`: o `catch` responde `success: true` com status 200 em caso de erro.
- `apps/api/package.json`: `main` aponta para `server.tsx`, mas o arquivo é `server.ts`.
- O ano está fixo como `"2026"` em `createYear.ts`.
- `DATABASE_URL` é obrigatória no schema, mas ainda não é usada.
