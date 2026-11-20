# Revisão — Workflows de trabalho como skills

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (achados corrigidos; ressalvas em "Riscos residuais")

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                                                                                                      |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `.claude/skills/{spec-authoring,feature,bugfix,revisar,pr}/SKILL.md` com as 8 seções; o harness lista `spec-authoring`, `feature`, `bugfix` e `revisar` (a `pr` não aparece por ser só manual) |
| CA2      | ✅        | `.claude/skills/spec-authoring/templates/{spec,technical-plan,review,handoff}.md`; links relativos conferidos pelo revisor                                                                     |
| CA3      | ✅        | `.claude/rules/git-workflow.md` e `.claude/rules/pending-fixes.md`                                                                                                                             |
| CA4      | ✅        | `docs/pendencias.md` com PF-001 a PF-014                                                                                                                                                       |
| CA5      | ✅        | `.claude/commands/revisar.md` removido; skill `revisar` delega ao subagente `revisor` e grava `review.md` (este arquivo é o primeiro)                                                          |
| CA6      | ✅        | `.github/pull_request_template.md`                                                                                                                                                             |
| CA7      | ✅        | CLAUDE.md (seção Workflows, regra de commits), `docs/convencoes.md#commits`, ADR 013, agentes `executor`, `rapido`, `revisor`                                                                  |
| CA8      | ✅        | branch `chore/workflows-skills`, um commit por incremento, spec, plano e este review                                                                                                           |

## Comandos executados

| Comando                                      | Resultado                              |
| -------------------------------------------- | -------------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test` | ✅ lint e tipos ok, 91 testes passando |
| Subagente `revisor` sobre `main...HEAD`      | ⚠️ 2 altos, 3 médios, 3 baixos         |

## Problemas encontrados

- [alta] `.claude/skills/pr/SKILL.md` e `.claude/rules/git-workflow.md` — o pós-merge mandava marcar a spec `concluída` e mover pendências já na `main` (commit direto na `main`, proibido pela própria rule) → corrigido: a demanda é fechada na branch antes do PR (nova etapa 3 do `/pr`).
- [alta] `.claude/skills/pr/SKILL.md` — `git branch -d` falha depois de squash merge → corrigido: `-D` após confirmar `MERGED` com `gh pr view`.
- [média] `.claude/skills/feature/SKILL.md` e `bugfix` — rodavam o `test:e2e` (escreve no Notion real) sem pedir autorização → corrigido: pedem autorização.
- [média] `.claude/skills/pr/SKILL.md` — sugeria push direto na `main` quando ela está à frente do `origin` → corrigido: o padrão é incluir os commits no PR; push na `main` só com pedido explícito, como exceção.
- [média] `docs/workflows/workflows-skills/` — incremento 5 e CA8 marcados antes de existir `review.md` → corrigido por este arquivo.
- [baixa] `.claude/skills/feature/SKILL.md` — branch fixa `feat/<slug>` mesmo para `chore`/`refactor` → corrigido: `<tipo>/<slug>` vindo da spec.
- [baixa] `.claude/skills/review/` — nome colidia com o `/review` embutido do Claude Code → corrigido: renomeada para `revisar` (mantém o nome que o usuário já usava).
- [baixa] `.claude/skills/pr/SKILL.md` — commit/push do link do PR não era anunciado na confirmação → corrigido: a etapa de confirmação descreve esse passo.

## Riscos residuais e limitações

- Skills e rules são instruções: nada **impede** um commit direto na `main` (`PF-008`, hook `PreToolUse`).
- O fluxo ainda não rodou de ponta a ponta numa feature de código real; a primeira demanda real vai mostrar ajustes.
- Base do PR conferida: `main` local igual ao `origin/main` (`9dd2695`, já enviada pelo usuário), então o PR contém só os commits desta demanda.
- Repositório no GitHub ainda aceita merge commit e rebase: para forçar squash, o usuário roda `gh repo edit --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false --delete-branch-on-merge` (alteração de configuração do repositório, não feita aqui).
