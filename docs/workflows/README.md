# Workflows e demandas

Cada demanda (feature, bugfix, chore...) tem uma pasta aqui, com o mesmo slug da branch:

```
docs/workflows/<slug>/
├── spec.md             # o quê: objetivo, critérios de aceitação, fora de escopo
├── technical-plan.md   # como: abordagem, arquivos, incrementos, validação, reversão
├── review.md           # revisão antes do PR: veredito, evidências, riscos
└── handoff.md          # só se a demanda for pausada no meio
```

Os templates ficam em `.claude/skills/spec-authoring/templates/`.

## Fluxo

```
pedido ─▶ spec-authoring ─▶ feature | bugfix ─▶ revisar ─▶ /pr ─▶ merge commit na main
          (spec + plano)    (branch, incrementos,  (revisor +   (push + PR,
                             1 commit cada)          review.md)   só por /pr)
```

| Skill            | Como chamar                         | Faz                                                                 |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `spec-authoring` | automático ou `/spec-authoring ...` | escreve `spec.md` e `technical-plan.md`                             |
| `feature`        | automático ou `/feature ...`        | branch `feat/<slug>`, incrementos com testes, portão, docs, revisão |
| `feat`           | **só** `/feat ...`                  | atalho para a `feature`                                             |
| `bugfix`         | automático ou `/bugfix ...`         | branch `fix/<slug>`, teste que reproduz, causa raiz, correção       |
| `revisar`        | automático ou `/revisar [foco]`     | portão + subagente `revisor` + critérios → `review.md`              |
| `pr`             | **só** `/pr [--draft]`              | push, PR com o template, orienta o merge e a limpeza                |

Regras sempre carregadas: `.claude/rules/git-workflow.md` (branches, commits, merge commit) e `.claude/rules/pending-fixes.md` (registro em `docs/pendencias.md`).

## Status de uma demanda

`rascunho` → `em andamento` → `em revisão` → `concluída` (ou `pausada`, com `handoff.md`).

## Demandas

| Slug                                                          | Tipo    | Status     |
| ------------------------------------------------------------- | ------- | ---------- |
| [workflows-skills](./workflows-skills/)                       | chore   | concluída  |
| [log-operacoes-postgres-host](./log-operacoes-postgres-host/) | feature | concluída  |
| [regra-merge-commit](./regra-merge-commit/)                   | docs    | concluída  |
| [gitattributes-eol](./gitattributes-eol/)                     | chore   | concluída  |
| [years-jobs-assincronos](./years-jobs-assincronos/)           | feature | concluída  |
| [ci-github-actions](./ci-github-actions/)                     | chore   | concluída  |
| [guardrails-env-idioma](./guardrails-env-idioma/)             | chore   | concluída  |
| [testes-services-e-trava](./testes-services-e-trava/)         | test    | em revisão |
