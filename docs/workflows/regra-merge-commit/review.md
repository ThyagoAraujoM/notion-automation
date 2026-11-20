# Revisão — Merge commit em vez de squash

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (achados corrigidos; uma ressalva aceita)

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                                                                                                  |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CA1      | ✅        | rule `git-workflow`, CLAUDE.md, `docs/convencoes.md`, skill `pr`, agente `revisor`, templates de PR e de plano, `docs/workflows/README.md`; `git grep -i squash` só acha proibições e ADRs |
| CA2      | ✅        | rule `git-workflow` (commits que se sustentam sozinhos), etapa 4 da skill `pr`, etapa 4 da skill `revisar` (correção como commit novo)                                                     |
| CA3      | ✅        | rule `git-workflow` e etapa 10 da skill `pr` com `git branch -d`                                                                                                                           |
| CA4      | ✅        | ADR 015 em `docs/decisoes.md`; ADR 013 marcada como parcialmente substituída                                                                                                               |

## Comandos executados

| Comando                                      | Resultado                                |
| -------------------------------------------- | ---------------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test` | ✅ 96 testes                             |
| `git grep -n -i squash` (fora do histórico)  | ✅ só "não use squash" e as ADRs 013/015 |
| Subagente `revisor` sobre `main...HEAD`      | ⚠️ 5 observações baixas                  |

## Problemas encontrados

- [baixa] `.claude/skills/pr/SKILL.md` — o Handoff dizia "título (= futuro commit na `main`)", redação de squash → corrigido no commit `7308d65`.
- [baixa] `.claude/skills/revisar/SKILL.md` — a regra "correção de revisão vira commit próprio" só estava na rule → corrigido no commit `7308d65` (commit novo `fix:`, sem amend nem fixup).
- [baixa] `docs/workflows/README.md` — demanda "em andamento" com a spec "em revisão" → corrigido no commit `7308d65`.
- [baixa] `docs/pendencias.md` — a linha PF-015 alargou as colunas e o Prettier realinhou a tabela inteira → aceito: é o alinhamento automático do formatador; encurtar a descrição esconderia informação.
- [baixa] Working tree com ~15 arquivos "modificados" só por fim de linha → fora do escopo, registrado como `PF-015`; nenhum deles entrou nos commits (conferido com `git diff --ignore-cr-at-eol --stat`).

## Riscos residuais e limitações

- O GitHub ainda oferece squash e rebase no botão de merge; a regra depende de escolher "Create a merge commit" (o padrão). Para forçar: deixar só "Allow merge commits" nas configurações do repositório.
- Commits antigos que entraram por merge commit (#1 e #2) já seguem a regra nova; nada a reescrever.
