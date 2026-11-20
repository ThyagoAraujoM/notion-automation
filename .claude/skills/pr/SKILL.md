---
name: pr
description: Publica a demanda atual no GitHub — push da branch, abre o PR com o template a partir de spec e review, e orienta o squash merge e a limpeza depois. Só roda quando o usuário digita /pr.
argument-hint: "[--draft]"
disable-model-invocation: true
---

# Abrir PR

## Propósito

Levar a branch revisada para a `main` por um PR legível, que vira **um único commit** via squash merge.

## Quando usar

Depois da skill `revisar` com veredito ✅ ou ⚠️. Esta skill publica no GitHub (ação externa), por isso só roda por `/pr` (`disable-model-invocation`). Argumentos: `$ARGUMENTS` (ex.: `--draft`).

## Entradas

- Branch atual (`<tipo>/<slug>`), nunca a `main`.
- `docs/workflows/<slug>/spec.md`, `technical-plan.md` e `review.md`.
- Template do PR: `.github/pull_request_template.md`.
- `gh` autenticado (`gh auth status`).

## Etapas

1. **Confira o estado.** Branch ≠ `main`; sem alterações não commitadas; `review.md` existe com veredito ✅/⚠️; portão verde (`pnpm lint && pnpm check-types && pnpm test`).
2. **Confira a base.** `git fetch origin` e veja se a `main` local tem commits que não estão no `origin/main` (`git log origin/main..main`). Se tiver, o PR os incluiria: liste-os e avise o usuário. O padrão é incluí-los no PR (eles entram no squash). Push direto na `main` é exceção à rule `git-workflow`: só com pedido explícito do usuário para aquele caso.
3. **Feche a demanda na branch.** Antes de publicar, ainda na branch: spec com status `concluída` (o squash leva isso para a `main` no merge), linha da demanda atualizada em `docs/workflows/README.md` e pendências resolvidas movidas para "Resolvidas" em `docs/pendencias.md`. Commit `docs: fecha a demanda <slug>`. Nada disso é commitado depois na `main`.
4. **Monte o título e o corpo.** Título = Conventional Commit em português (vira a mensagem do squash). Corpo pelo template: resumo, link para a pasta da demanda, critérios com evidência, como testar (passos que o usuário pode repetir), riscos, pendências `PF-NNN`.
5. **Mostre título e corpo ao usuário e peça confirmação** antes de publicar, dizendo exatamente o que vai acontecer: push da branch, criação do PR e, depois, um commit + push com o link do PR na spec.
6. **Publique:** `git push -u origin <branch>` e `gh pr create --base main --title "<título>" --body-file <arquivo temporário no scratchpad>` (com `--draft` se pedido).
7. **Registre o PR** na spec (`PR:` com o link) e faça commit/push dessa atualização na branch (já anunciado na etapa 5).
8. **Oriente o merge:** pelo GitHub, **Squash and merge**, conferindo que a mensagem final é o título do PR. Não dê merge sem o usuário pedir.
9. **Depois do merge** (quando o usuário confirmar): confira `gh pr view --json state` = `MERGED`; então `git switch main && git pull` e `git branch -D <branch>`. É `-D` porque, depois de um squash, o git não reconhece a branch como mergeada (`-d` falha). Avise o usuário antes de apagar. Não há mais nada a commitar: a demanda foi fechada na etapa 3.

## Pontos de decisão

- Veredito ❌ ou portão vermelho: não abra o PR.
- Conflito com a `main`: atualize a branch (`git merge origin/main` ou rebase, perguntando ao usuário se a branch já foi enviada) e rode o portão de novo.
- Usuário pede merge pelo terminal: `gh pr merge --squash --delete-branch` só com pedido explícito.

## Quality gates

- PR aponta para `main`, título em Conventional Commit, corpo com link para `docs/workflows/<slug>/`.
- Nada publicado sem confirmação do usuário.

## Critério de saída

PR aberto e registrado na spec; usuário sabe como dar o squash merge e o que fazer depois.

## Handoff

Informe: link do PR, título (= futuro commit na `main`), checks pendentes e os passos pós-merge.
