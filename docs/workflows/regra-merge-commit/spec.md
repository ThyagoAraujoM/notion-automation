# Merge commit em vez de squash

- **Slug:** `regra-merge-commit`
- **Tipo:** docs
- **Status:** concluída
- **Branch:** `docs/regra-merge-commit`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Trocar a regra de integração na `main` de **squash merge** para **merge commit**, mantendo na `main` cada commit da branch, para rastrear em qual commit cada modificação foi feita. Pedido do usuário depois dos PRs #1 e #2.

## Contexto

A ADR 013 escolheu squash ("um pedido = um commit na `main`"). Na prática, os PRs #1 e #2 entraram como merge commit e o usuário prefere assim: os commits por incremento ficam visíveis na `main` e o commit de merge agrupa a demanda. O GitHub do repositório aceita os três métodos e usa merge commit por padrão.

## Critérios de aceitação

- [x] **CA1** — Rule `.claude/rules/git-workflow.md`, CLAUDE.md, `docs/convencoes.md#commits`, skill `pr`, agente `revisor`, template de PR, template de plano e `docs/workflows/README.md` descrevem merge commit; nenhuma menção a squash como regra.
- [x] **CA2** — A regra deixa explícito o que muda com commits visíveis na `main`: cada commit da branch precisa se sustentar sozinho (portão verde, Conventional Commit, sem "wip"/"fixup"); correção de revisão vira commit próprio.
- [x] **CA3** — Pós-merge usa `git branch -d` (a branch é reconhecida como mergeada).
- [x] **CA4** — ADR 015 registra a troca; ADR 013 aponta para ela.

## Fora de escopo

- Configurar o GitHub para aceitar só merge commit (alteração de configuração do repositório, a cargo do usuário).
- Reescrever o histórico já existente.

## Riscos e dúvidas em aberto

- Histórico da `main` fica maior; `git log --first-parent main` mostra só os merges (uma linha por demanda) quando quiser a visão resumida.
