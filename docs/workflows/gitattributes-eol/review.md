# Revisão — Fim de linha LF em todo o repositório

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (textos corrigidos; ordem de merge com `docs/regra-merge-commit`)

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                      |
| -------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `.gitattributes` com `* text=auto eol=lf` e binários; `favicon.ico` aparece como `-text` (binário respeitado)  |
| CA2      | ✅        | `git ls-files --eol`: `i/lf w/lf` em todos os arquivos de texto (antes: 30 com `w/crlf`)                       |
| CA3      | ✅        | `pnpm format` + `git status` limpo; commits `d8c273c`, `a0d5ccf` e `78bebec` sem o aviso "LF will be replaced" |
| CA4      | ✅        | `git diff --cached` vazio após `git add --renormalize .`; lint, tipos e 96 testes passam                       |
| CA5      | ✅        | `docs/convencoes.md` (Geral) e ADR 016; `PF-015` movida para "Resolvidas" no fechamento do `/pr`               |

## Comandos executados

| Comando                                      | Resultado                   |
| -------------------------------------------- | --------------------------- |
| `git ls-files --eol` (antes / depois)        | 30 `w/crlf` → 0             |
| `git add --renormalize .`                    | nenhuma mudança de conteúdo |
| `pnpm format` + `git status --short`         | ✅ limpo                    |
| `pnpm lint && pnpm check-types && pnpm test` | ✅ 96 testes                |
| Subagente `revisor` sobre `main...HEAD`      | ⚠️ 1 média, 2 baixas        |

## Problemas encontrados

- [média] `docs/decisoes.md`, `docs/convencoes.md`, `docs/pendencias.md` — a branch `docs/regra-merge-commit` (ainda sem PR) mexe nos mesmos arquivos: ADR 015, regra de commits e a linha `PF-015`. Mergear esta antes deixaria a ADR 016 antes da 015 e o fechamento de `PF-015` sem a linha correspondente na `main` → **ordem combinada:** PR de `docs/regra-merge-commit` primeiro; depois esta branch recebe a `main` (`git merge origin/main`), resolve os conflitos de docs mantendo 015 antes de 016 e só então fecha `PF-015` e abre o PR.
- [baixa] `docs/convencoes.md` — a dica de `git add --renormalize .` sugeria que ele conserta o disco → corrigido em `78bebec` (só regrava o índice; para clone antigo, clonar de novo ou `git rm --cached -r . && git reset --hard`, com aviso de perda de alterações).
- [baixa] ADR 016 — precedência do `.gitattributes` sobre o `core.autocrlf` e o passo para clones antigos só estavam implícitos → corrigido em `78bebec`.

## Riscos residuais e limitações

- Clones antigos (outra máquina) podem continuar com `CRLF` no disco até renormalizar ou clonar de novo.
- A conversão tocou o `.env.example` no disco (só fim de linha; o conteúdo foi conferido por script e não exibido).
