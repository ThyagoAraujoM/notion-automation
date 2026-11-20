# Plano técnico — CI no GitHub Actions

> Spec: [spec.md](./spec.md)

## Abordagem

Um workflow com um único job (`gate`) que repete o que rodamos localmente: install com lockfile congelado, `lint`, `check-types`, `test` e `build`. Um job só (em vez de um por etapa) evita instalar as dependências várias vezes; o custo é não ver em paralelo qual etapa falhou, mas cada etapa é um passo separado e o log aponta a que quebrou. A versão do pnpm vem do `packageManager` do `package.json`; o Node é o 22 (o Prisma 7 exige >= 20.19).

Alternativas descartadas: um job por etapa (reinstala tudo cada vez, sem ganho com um repositório pequeno); incluir o E2E (lento e escreve no Notion real); subir Postgres como `services:` (os testes atuais não usam banco; fica para `PF-006`).

## Arquivos e contratos afetados

| Arquivo                                                       | Mudança                                              |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `.github/workflows/ci.yml`                                    | novo                                                 |
| `docs/convencoes.md`, `docs/decisoes.md`                      | seção "CI" e ADR 018                                 |
| `CLAUDE.md`, `docs/pendencias.md`, `docs/workflows/README.md` | menção ao CI, `PF-002` resolvida, tabela de demandas |

Nenhum contrato de código muda.

## Incrementos

| #   | Mudança                           | Testes previstos                          | Critérios | Pronto quando  | Status       |
| --- | --------------------------------- | ----------------------------------------- | --------- | -------------- | ------------ |
| 1   | Spec e plano                      | — (docs)                                  | —         | commitados     | ✅ `4f75b15` |
| 2   | `ci.yml`                          | portão e `pnpm build` locais; YAML válido | CA1–CA3   | portão verde   | ✅ `cfd3b76` |
| 3   | Docs, ADR 018, `PF-002` resolvida | portão                                    | CA4       | docs coerentes | ✅ `1fbef38` |

## Validação

- Local: `pnpm install --frozen-lockfile && pnpm lint && pnpm check-types && pnpm test && pnpm build`.
- No GitHub (CA5): abrir o PR e conferir o check `Portão (lint, tipos, testes, build)` verde; depois o usuário exige esse check na branch protection da `main`.

## Reversão

Apagar `.github/workflows/ci.yml` (ou reverter o merge) desliga o CI sem afetar o código. Se a branch protection exigir o check, remova a exigência antes.

## Acompanhamento

- 2026-11-20 — Portão e `pnpm build` rodaram verdes localmente com o lockfile congelado (os testes não precisam de `.env`).
