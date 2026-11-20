# Plano técnico — Workflows de trabalho como skills

> Spec: [spec.md](./spec.md)

## Abordagem

Cada workflow vira uma **skill de projeto** (`.claude/skills/<nome>/SKILL.md`): a `description` faz o Claude escolher a skill certa sozinho e `/nome` permite chamar manualmente. Regras que valem em toda sessão (git, pendências) ficam em `.claude/rules/`, que o Claude Code carrega automaticamente. Os templates ficam como arquivos de apoio da `spec-authoring` (só são lidos quando a skill precisa). Os artefatos de cada demanda ficam em `docs/workflows/<slug>/`, versionados com o código.

- `pr` tem `disable-model-invocation: true`: abrir PR é ação externa (publica no GitHub), então só roda quando o usuário digita `/pr`.
- A revisão continua isolada no subagente `revisor` (contexto próprio, não se convence com o que a sessão principal já pensou); a skill `revisar` orquestra e grava `review.md`.

Alternativas descartadas: uma pasta `workflow/` só com markdown referenciada no CLAUDE.md (funciona, mas o Claude não descobre sozinho qual usar); colocar tudo no CLAUDE.md (incha o contexto de toda sessão; a doc recomenda menos de 200 linhas).

## Arquivos e contratos afetados

| Arquivo / contrato                                          | Mudança                                           |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `.claude/skills/{spec-authoring,feature,bugfix,review,pr}/` | novas skills                                      |
| `.claude/skills/spec-authoring/templates/*.md`              | templates dos artefatos                           |
| `.claude/rules/git-workflow.md`, `pending-fixes.md`         | novas regras sempre carregadas                    |
| `.claude/commands/revisar.md`                               | removido (substituído pela skill `revisar`)       |
| `.claude/agents/*.md`                                       | apontam para as skills e para o fluxo de branches |
| `.github/pull_request_template.md`                          | novo                                              |
| `docs/pendencias.md`, `docs/workflows/README.md`            | novos                                             |
| `CLAUDE.md`, `docs/convencoes.md`, `docs/decisoes.md` (013) | fluxo novo e regra de commits com squash          |

Contrato que muda: a regra de commits. Antes, um commit por pedido direto na `main`; agora, commits por incremento na branch e um commit por pedido na `main` via squash merge.

## Incrementos

| #   | Mudança                                              | Testes previstos                      | Critérios | Pronto quando                          | Status |
| --- | ---------------------------------------------------- | ------------------------------------- | --------- | -------------------------------------- | ------ |
| 1   | Templates, spec e plano desta demanda                | — (docs)                              | CA2, CA8  | arquivos criados e formatados          | ✅     |
| 2   | Rules (git, pendências) e `docs/pendencias.md`       | — (docs)                              | CA3, CA4  | rules carregam; backlog com IDs        | ✅     |
| 3   | Skills spec-authoring, feature, bugfix, review, pr   | aparecem na lista de skills da sessão | CA1, CA5  | 5 skills listadas; `/revisar` removido | ✅     |
| 4   | PR template, CLAUDE.md, convenções, ADR 013, agentes | portão do monorepo                    | CA6, CA7  | docs coerentes; portão verde           | ✅     |
| 5   | Review desta demanda (`review.md`)                   | agente `revisor`                      | todos     | veredito registrado                    | ✅     |

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test` (nada de código muda, mas o `prettier` formata os markdown pelo hook).
- Específico: as skills novas aparecem na lista de skills da sessão (o harness relê `.claude/skills/`).
- Verificação substituta: usar o próprio fluxo nesta demanda (CA8) e, depois do merge, rodar `/feature` numa demanda real.

## Reversão

Reverter o commit do squash na `main`. Nada de runtime depende destes arquivos.

## Acompanhamento

- 2026-11-20 — Usuário escolheu `docs/workflows/<slug>/` em vez de `docs/specs/`. Branch criada a partir da `main` local, que está 6 commits à frente do `origin/main` (ainda sem push): o PR vai precisar do push da `main` antes, ou vai incluir esses commits.
