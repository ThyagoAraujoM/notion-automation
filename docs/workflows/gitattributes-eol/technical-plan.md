# Plano técnico — Fim de linha LF em todo o repositório

> Spec: [spec.md](./spec.md)

## Abordagem

`.gitattributes` com `* text=auto eol=lf`: o Git trata como texto tudo o que detectar como texto e usa `LF` no repositório **e** no disco, ignorando o `core.autocrlf` da máquina. Binários conhecidos marcados como `binary`. Depois, colocar em `LF` os arquivos que o checkout tinha escrito em `CRLF` e atualizar o índice com `git add --renormalize .` (sem mudança de conteúdo).

Alternativa descartada: `git config core.autocrlf false` só na máquina do usuário (não vai junto com o repositório; outra máquina ou pessoa teria o mesmo problema).

## Arquivos e contratos afetados

| Arquivo                                  | Mudança                          |
| ---------------------------------------- | -------------------------------- |
| `.gitattributes`                         | novo                             |
| 30 arquivos versionados (só no disco)    | `CRLF` → `LF`, conteúdo idêntico |
| `docs/convencoes.md`, `docs/decisoes.md` | regra e ADR 016                  |

Nenhum contrato de código muda.

## Incrementos

| #   | Mudança                                               | Testes previstos                                                     | Critérios | Pronto quando              | Status       |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- | --------- | -------------------------- | ------------ |
| 1   | `.gitattributes`, disco em `LF`, índice renormalizado | `git ls-files --eol`; `pnpm format` + `git status`; commit sem aviso | CA1–CA4   | status limpo após formatar | ✅ `d8c273c` |
| 2   | Plano, convenções e ADR 016                           | portão                                                               | CA5       | docs coerentes             | ✅           |

## Validação

- `git ls-files --eol`: `i/lf w/lf` em todos os arquivos de texto (antes: 30 com `w/crlf`).
- `pnpm format` seguido de `git status --short`: nada além do que foi mudado de verdade.
- Commit sem o aviso "LF will be replaced by CRLF".
- Portão: `pnpm lint && pnpm check-types && pnpm test`.

## Reversão

Reverter o merge desta demanda remove o `.gitattributes`; o Git volta a usar o `core.autocrlf` da máquina. Os arquivos no repositório já estavam em `LF` e não mudam.

## Acompanhamento

- 2026-11-20 — Medição antes: repositório com 121 arquivos de texto em `LF` (nada a renormalizar no conteúdo); disco com 30 em `CRLF` e 91 em `LF`.
- 2026-11-20 — Depois de converter o disco, o `git status` ainda marcava os 30 arquivos (`needs update`) com diff vazio: o índice guardava os dados calculados com a regra antiga. Um segundo `git add --renormalize .` atualizou o índice sem colocar mudança de conteúdo no stage, e o status ficou limpo.
- 2026-11-20 — A conversão tocou o `.env.example` (só fim de linha, conteúdo idêntico; o script conferiu e nada foi exibido).
