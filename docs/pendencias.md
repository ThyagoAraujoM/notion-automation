# Pendências

> Problemas e melhorias conhecidos que ainda não viraram demanda. Regra de registro em `.claude/rules/pending-fixes.md`.
> Para atacar uma: crie a demanda (skill `feature` ou `bugfix`) e cite o ID na spec.

## Abertas

| ID     | Origem           | Descrição                                                                               | Impacto                            | Sugestão                                                                   |
| ------ | ---------------- | --------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| PF-007 | workflows-skills | Workflows e templates vivem só neste projeto (`.claude/skills/`)                        | próximos projetos começam do zero  | extrair as partes genéricas para um plugin próprio no GitHub (marketplace) |
| PF-014 | retrospectiva    | Retrospectiva atualizada e guia reutilizável de boas práticas para os próximos projetos | aprendizado fica espalhado no chat | documento único (retrospectiva + guia), publicado para consulta            |

## Resolvidas

| ID     | Data       | Como                                                                                                                                                                                                                     |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PF-016 | 2026-11-20 | no shutdown (`SIGINT`/`SIGTERM`) os jobs do processo viram `failed` e as travas são soltas, sem esperar; gravação do desfecho retentada, demanda `jobs-ano-shutdown`, PR #14                                             |
| PF-012 | 2026-11-20 | botão de tema (lua/sol) no canto superior direito da landing, com persistência e `prefers-color-scheme`, demanda `toggle-tema-web`, PR #13                                                                               |
| PF-010 | 2026-11-20 | ADRs 001–003 de `docs/decisoes.md` com alternativas e consequências preenchidas                                                                                                                                          |
| PF-013 | 2026-11-20 | `GET /databases/:databaseId/schema` testada contra o Notion real: 200 com ID em minúsculas, com e sem hífens. O erro visto antes era página desatualizada. Nota: ID em maiúsculas passa no regex e o Notion responde 400 |
| PF-006 | 2026-11-20 | testes dos services com Notion falso em memória e da trava (unitário com Prisma mockado + integração com Postgres, `test:integration`), demanda `testes-services-e-trava`, PR #10                                        |
| PF-008 | 2026-11-20 | hook `PreToolUse` `guard.mjs` bloqueia commit na `main` e leitura do arquivo de ambiente por shell (ADR 020), demanda `guardrails-env-idioma`                                                                            |
| PF-009 | 2026-11-20 | lint de `process.env`, teste `env-consistency` e skills `nova-variavel-env` e `nova-migration` (ADR 020), demanda `guardrails-env-idioma`                                                                                |
| PF-011 | 2026-11-20 | política de idioma (ADR 021): mensagens em português sem rótulos técnicos, Zod com locale `pt`, demanda `guardrails-env-idioma`                                                                                          |
| PF-001 | 2026-11-20 | criar, reparar e apagar respondem 202 e rodam em segundo plano; `GET /years/jobs/:jobId` (ADR 017), demanda `years-jobs-assincronos`, PR #5                                                                              |
| PF-002 | 2026-11-20 | workflow `.github/workflows/ci.yml` (install, lint, tipos, testes, build do web; ADR 018), demanda `ci-github-actions`. Falta exigir o check na branch protection                                                        |
| PF-005 | 2026-11-20 | `engines.node` `>=20.19`; build com tsup (`dist/server.js`), scripts `build`/`start`/`start:local` (ADR 019), demanda `build-start-api`                                                                                  |
| PF-003 | 2026-11-20 | tabela única `operation_log` com sucesso e erro (ADR 014), demanda `log-operacoes-postgres-host`                                                                                                                         |
| PF-004 | 2026-11-20 | variável `POSTGRES_HOST` (padrão `localhost`), demanda `log-operacoes-postgres-host`                                                                                                                                     |
| PF-015 | 2026-11-20 | `.gitattributes` com `* text=auto eol=lf` (ADR 016), demanda `gitattributes-eol`                                                                                                                                         |
