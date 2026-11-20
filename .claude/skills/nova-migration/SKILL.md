---
name: nova-migration
description: Passo a passo para mudar o banco do notion-automation (tabela ou coluna nova) com Prisma 7 - schema.prisma, migration em dev, client gerado, testes e deploy. Use quando o usuário pedir tabela, coluna, índice ou qualquer mudança no Postgres.
---

# Nova migration (Prisma)

Banco: Postgres no Docker (`pnpm db:up`). Schema em `apps/api/prisma/schema.prisma`; acesso em `apps/api/src/db/` (funções finas sobre o client, nunca Prisma direto nas rotas/services).

1. **Suba o banco**: `pnpm db:up`. As `POSTGRES_*` ficam no arquivo de ambiente (não leia; peça ao usuário se faltar algo).
2. **Edite o `schema.prisma`**: model em PascalCase inglês, `@@map` para a tabela em snake_case, `@map` nas colunas (veja `OperationLog` e `YearJob`).
3. **Gere a migration**: `pnpm --filter=@notion-automation/api db:migrate --name <descricao_em_snake_case>`. Cria `prisma/migrations/<timestamp>_<nome>/migration.sql` e regenera o client em `src/generated` (ignorado pelo git).
4. **Leia o `migration.sql` gerado**: confira que não apaga dados (`DROP`) e que coluna `NOT NULL` nova tem `DEFAULT` quando a tabela já tem linhas. Nunca edite uma migration já aplicada ou mergeada: crie outra.
5. **Camada `db/`**: adicione a função em `apps/api/src/db/<assunto>.ts` com teste ao lado (Prisma mockado, como em `year-job.test.ts`).
6. **Compatibilidade e reversão**: registre no `technical-plan.md` como desfazer (migration de volta ou `DROP` manual) e se o deploy precisa rodar `db:deploy` antes de subir a API.
7. **Docs**: `docs/arquitetura.md` (tabelas) e uma ADR em `docs/decisoes.md` se a modelagem for uma escolha.
8. Rode `pnpm lint && pnpm check-types && pnpm test`.

`db:deploy` aplica as migrations já criadas (produção/CI); `db:migrate` só em desenvolvimento.
