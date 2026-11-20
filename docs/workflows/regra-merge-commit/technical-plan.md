# Plano técnico — Merge commit em vez de squash

> Spec: [spec.md](./spec.md)

## Abordagem

Substituir "squash" por "merge commit" em todos os lugares que descrevem o fluxo (levantados com `git grep -i squash`), registrar a decisão como ADR 015 e marcar a ADR 013 como parcialmente substituída. Só documentação e instruções; nenhum código muda.

## Arquivos e contratos afetados

| Arquivo                                                       | Mudança                                             |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `.claude/rules/git-workflow.md`                               | regra de merge e de qualidade dos commits da branch |
| `.claude/skills/pr/SKILL.md`, `.claude/agents/revisor.md`     | merge commit, `branch -d`, título do PR             |
| `CLAUDE.md`, `docs/convencoes.md`, `docs/workflows/README.md` | descrição do fluxo                                  |
| `.github/pull_request_template.md`, template de plano         | checklist e reversão                                |
| `docs/decisoes.md`                                            | ADR 015; ADR 013 aponta para ela                    |

Contrato que muda: a regra de integração na `main` (processo), não o código.

## Incrementos

| #   | Mudança                       | Testes previstos                         | Critérios          | Pronto quando            | Status |
| --- | ----------------------------- | ---------------------------------------- | ------------------ | ------------------------ | ------ |
| 1   | Spec, plano e todas as trocas | `git grep -i squash` só em histórico/ADR | CA1, CA2, CA3, CA4 | portão verde; grep limpo | ✅     |

## Validação

- `git grep -n -i squash` fora de `docs/workflows/<demandas antigas>` e da ADR 013/015 não retorna regra.
- Portão: `pnpm lint && pnpm check-types && pnpm test` (não deve mudar nada).

## Reversão

Reverter o merge commit desta demanda (`git revert -m 1 <merge>`).

## Acompanhamento

- 2026-11-20 — Demandas antigas (`workflows-skills`, `log-operacoes-postgres-host`) mantêm o texto de quando foram feitas: são registro histórico.
- 2026-11-20 — Registrada `PF-015` (fim de linha misto, sem `.gitattributes`): fora do escopo, cada formatação marca dezenas de arquivos como modificados só por CRLF/LF.
