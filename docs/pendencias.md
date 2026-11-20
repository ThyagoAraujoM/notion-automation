# Pendências

> Problemas e melhorias conhecidos que ainda não viraram demanda. Regra de registro em `.claude/rules/pending-fixes.md`.
> Para atacar uma: crie a demanda (skill `feature` ou `bugfix`) e cite o ID na spec.

## Abertas

| ID     | Origem                           | Descrição                                                                                                            | Impacto                                               | Sugestão                                                                                               |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| PF-001 | retrospectiva (ponto 5)          | `POST /years` é uma requisição síncrona de 6–7 min (`apps/api/src/http/routes/years/create-year.ts`)                 | proxies/front cortam; cliente fica preso              | 202 + job + polling, fila no próprio Postgres (pg-boss ou graphile-worker)                             |
| PF-002 | retrospectiva (ponto 4.2)        | Não há CI (`.github/workflows/` não existe)                                                                          | portão depende de alguém lembrar de rodar             | GitHub Actions: install, `prisma generate`, lint, tipos, testes, build do web; check obrigatório no PR |
| PF-005 | retrospectiva (ponto 5)          | API sem `build`/`start` de produção; `engines.node >=18` desalinhado com o Prisma 7                                  | sem caminho de deploy                                 | build com tsc/tsup, script `start`, alinhar `engines`                                                  |
| PF-006 | testes unitários                 | Services (`create-year`, `repair-year`, `delete-year`) e a trava real (`withYearLock` + Postgres) sem teste unitário | regressão só aparece no E2E (~5 min)                  | testes de service com Notion mockado; teste de integração da trava com Postgres                        |
| PF-007 | workflows-skills                 | Workflows e templates vivem só neste projeto (`.claude/skills/`)                                                     | próximos projetos começam do zero                     | extrair as partes genéricas para um plugin próprio no GitHub (marketplace)                             |
| PF-008 | workflows-skills / regra de ouro | Nada impede commit direto na `main` nem leitura do `.env` via Bash (o `deny` cobre só a ferramenta Read)             | regras dependem de a IA lembrar                       | hooks `PreToolUse`: bloquear `git commit` na `main` e comandos que leiam `.env`                        |
| PF-009 | regra de ouro                    | Sem verificação automática de `process.env` fora do `packages/env` nem de variável faltando no `.env.example`        | variável esquecida só aparece em runtime              | teste/lint que confira as duas coisas; skills `nova-variavel-env` e `nova-migration`                   |
| PF-010 | retrospectiva                    | ADRs 001–003 em `docs/decisoes.md` com campos `_preencher_`                                                          | contexto das escolhas iniciais incompleto             | preencher alternativas e consequências                                                                 |
| PF-011 | retrospectiva                    | Mensagens da API misturam português e rótulos em inglês (422 de templates usa `quarter:`, `week:`...)                | mensagens inconsistentes                              | traduzir os rótulos (ou i18n se surgir outro idioma)                                                   |
| PF-012 | landing page                     | Dark mode do shadcn é por classe (`.dark`) e não há alternador em `apps/web`                                         | página sempre clara                                   | seguir `prefers-color-scheme` ou adicionar toggle                                                      |
| PF-013 | teste manual da API              | Rota `GET /databases/:databaseId/schema` não foi testada contra o Notion real depois do refactor                     | baixo (rota só de leitura, coberta por teste de rota) | chamar com um ID real de database e conferir 200                                                       |
| PF-014 | retrospectiva                    | Retrospectiva atualizada e guia reutilizável de boas práticas para os próximos projetos                              | aprendizado fica espalhado no chat                    | documento único (retrospectiva + guia), publicado para consulta                                        |

## Resolvidas

| ID     | Data       | Como                                                                                             |
| ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| PF-003 | 2026-11-20 | tabela única `operation_log` com sucesso e erro (ADR 014), demanda `log-operacoes-postgres-host` |
| PF-004 | 2026-11-20 | variável `POSTGRES_HOST` (padrão `localhost`), demanda `log-operacoes-postgres-host`             |
| PF-015 | 2026-11-20 | `.gitattributes` com `* text=auto eol=lf` (ADR 016), demanda `gitattributes-eol`                 |
