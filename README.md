# Notion Automation

API que gera no Notion a rotina de planejamento **Ano → Trimestres → Meses → Semanas → Dias**, cada nível num database próprio, com as páginas ligadas por relações e criadas a partir dos templates de cada database.

Primeiro projeto desenvolvido com IA (Claude Code) como par de programação: além do código, ele serve de base de boas práticas (documentação para a IA, agentes, skills, hooks e testes).

## Estrutura

| Pasta                                                  | O que é                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `apps/api`                                             | API Fastify 5 + Zod 4 + `@notionhq/client` v5 + Prisma 7 |
| `apps/web`                                             | Landing page (Next.js 16 + Tailwind 4 + shadcn/ui)       |
| `packages/env`                                         | Validação das variáveis de ambiente (`@t3-oss/env-core`) |
| `packages/eslint-config`, `packages/typescript-config` | Configs compartilhadas                                   |
| `docs/`                                                | Arquitetura, convenções e decisões (ADRs)                |
| `.claude/`                                             | Configuração do Claude Code: agentes, skills, hooks      |

## Como rodar

```sh
pnpm install
cp .env.example .env        # preencha NOTION_TOKEN, os *_DATABASE_ID e POSTGRES_*
pnpm db:up                  # Postgres no Docker
pnpm --filter=@notion-automation/api db:deploy
pnpm dev                    # API em :4000 (Swagger em /docs) e Web em :3000
```

## Rotas

| Método | Rota                            | O que faz                             |
| ------ | ------------------------------- | ------------------------------------- |
| POST   | `/years`                        | Cria o ano (`{ year?, startToday? }`) |
| POST   | `/years/:year/repair`           | Repara o ano (`{ startToday? }`)      |
| DELETE | `/years/:year`                  | Apaga o ano (vai para a lixeira)      |
| GET    | `/databases/:databaseId/schema` | Estrutura de um database do Notion    |

## Qualidade

```sh
pnpm lint && pnpm check-types && pnpm test        # rápido, sem rede
pnpm --filter=@notion-automation/api test:e2e     # ~5 min, no Notion real (ano 2090)
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md), [docs/convencoes.md](docs/convencoes.md) e [docs/decisoes.md](docs/decisoes.md).
