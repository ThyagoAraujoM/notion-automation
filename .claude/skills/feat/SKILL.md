---
name: feat
description: Atalho manual para iniciar uma feature — mesmo fluxo da skill feature. Uso /feat <descrição>.
argument-hint: "[descrição da feature]"
disable-model-invocation: true
---

# /feat — atalho para a skill `feature`

Pedido: **$ARGUMENTS**

Siga **integralmente** a skill `feature` (`.claude/skills/feature/SKILL.md`) com o pedido acima, da etapa 1 (branch `feat/<slug>`) à revisão. Este arquivo não tem regras próprias: se algo mudar no fluxo, mude na skill `feature`.

Se o pedido estiver vazio, pergunte qual feature implementar antes de criar a branch.
