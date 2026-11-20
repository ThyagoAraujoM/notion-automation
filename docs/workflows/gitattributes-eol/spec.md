# Fim de linha LF em todo o repositório (.gitattributes)

- **Slug:** `gitattributes-eol`
- **Tipo:** chore
- **Status:** concluída
- **Branch:** `chore/gitattributes-eol`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Acabar com os arquivos marcados como "modificados" só por fim de linha (`PF-015`), fixando `LF` como padrão do repositório em qualquer máquina, igual ao que o Prettier grava.

## Contexto

- O Git do usuário (Windows) usa `core.autocrlf=true`: guarda `LF` no repositório e escreve `CRLF` no disco ao fazer checkout.
- O Prettier grava sempre `LF` (padrão `endOfLine: "lf"`) e roda após cada edição do Claude (hook `.claude/hooks/format.mjs`) e em `pnpm format`.
- Resultado medido com `git ls-files --eol` em 2026-11-20: no repositório, os 121 arquivos de texto já estão em `LF`; no disco, 30 em `CRLF` e 91 em `LF`. O `git status` mostrava ~14 arquivos modificados sem diferença de conteúdo, e todo commit emitia o aviso "LF will be replaced by CRLF".
- Não há `.gitattributes` no repositório.

## Critérios de aceitação

- [x] **CA1** — `.gitattributes` na raiz com `* text=auto eol=lf` e binários conhecidos marcados como `binary`.
- [x] **CA2** — `git ls-files --eol`: todos os arquivos de texto com `i/lf` e `w/lf`.
- [x] **CA3** — Depois de `pnpm format`, `git status` não mostra arquivos modificados sem mudança de conteúdo, e os commits não emitem o aviso de conversão.
- [x] **CA4** — Nenhum conteúdo de arquivo muda (só bytes de fim de linha no disco); portão verde.
- [x] **CA5** — `PF-015` resolvida; a regra fica registrada para os próximos projetos (convenções/ADR).

## Fora de escopo

- Mudar a configuração global do Git do usuário (`core.autocrlf`): o `.gitattributes` tem precedência nos arquivos deste repositório.
- Arquivos fora do git (`.env`, `node_modules`, gerados).

## Riscos e dúvidas em aberto

- Branches abertas (`docs/regra-merge-commit`) não têm o `.gitattributes` até serem atualizadas com a `main`; enquanto isso o ruído pode aparecer nelas.
