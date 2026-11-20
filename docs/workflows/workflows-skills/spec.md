# Workflows de trabalho como skills (feature, bugfix, review, PR)

- **Slug:** `workflows-skills`
- **Tipo:** chore
- **Status:** concluída
- **Branch:** `chore/workflows-skills`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Dar ao projeto um processo repetível para cada tipo de trabalho (feature, bugfix, revisão, PR), executável pelo Claude Code como skills, com branches por demanda e squash merge na `main`. Servir de molde para os próximos projetos.

## Contexto

Até aqui todo commit ia direto na `main` e o "processo" vivia só no CLAUDE.md e em `docs/convencoes.md`. Havia uma skill de receita (`criar-endpoint`), um comando `/revisar` e o agente `revisor`, mas nada dizia como uma demanda começa, é dividida, validada, revisada e entregue. O repositório tem remoto no GitHub e o `gh` está autenticado.

Decisões tomadas com o usuário (2026-11-20): squash merge; artefatos das demandas em `docs/workflows/<slug>/`; núcleo de workflows agora (spec-authoring, feature, bugfix, review, pr); reuso em outros projetos via plugin depois.

## Critérios de aceitação

- [x] **CA1** — Existem as skills `spec-authoring`, `feature`, `bugfix`, `revisar` e `pr` em `.claude/skills/`, cada uma com Propósito, Quando usar, Entradas, Etapas, Pontos de decisão, Quality gates, Critério de saída e Handoff.
- [x] **CA2** — Os templates `spec.md`, `technical-plan.md`, `review.md` e `handoff.md` ficam dentro da skill `spec-authoring` e as outras skills os referenciam.
- [x] **CA3** — Regras sempre carregadas em `.claude/rules/`: fluxo git (branch por demanda, commits por incremento, squash merge, nada direto na `main`) e registro de correções pendentes.
- [x] **CA4** — `docs/pendencias.md` existe com IDs `PF-NNN` e recebe o backlog combinado com o usuário.
- [x] **CA5** — O `/revisar` deixa de ser um comando solto e vira a skill `revisar`, que usa o agente `revisor` e grava `review.md`.
- [x] **CA6** — `.github/pull_request_template.md` com os mesmos campos do handoff de PR.
- [x] **CA7** — CLAUDE.md, `docs/convencoes.md`, `docs/decisoes.md` e os agentes descrevem o fluxo novo (regra de commits atualizada para squash).
- [x] **CA8** — Esta própria demanda segue o fluxo (branch, spec, plano, review) como exemplo.

## Fora de escopo

- Extrair os workflows para um plugin reutilizável (registrado como `PF-007`).
- Workflows `triage`, `refactor` e `handoff` como skills próprias (o template `handoff.md` já existe).
- Configurar o repositório no GitHub (squash only, proteção da `main`): exige permissão do usuário; o comando fica documentado.
- CI no GitHub Actions (`PF-002`).

## Riscos e dúvidas em aberto

- Skills são instruções, não garantias: nada impede um commit direto na `main`. Um hook que bloqueie isso está proposto como `PF-008`.
