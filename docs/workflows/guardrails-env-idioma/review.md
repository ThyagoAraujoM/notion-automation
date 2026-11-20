# Revisão — Guard-rails automáticos, checagem do env e política de idioma

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (limitações do hook por regex e do parser do teste de env, abaixo)

## Critérios de aceitação

| Critério | Atendido? | Evidência (teste, comando, arquivo)                                                                                                     |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `.claude/hooks/guard.test.mjs` (casos na `main`, `-C`, subshell, `sudo`, repositório temporário)                                        |
| CA2      | ✅        | `guard.test.mjs`: bloqueia `.env`, `.env.local`, `.env.production.local`, `.env*`; libera `.env.example`, `process.env`, `packages/env` |
| CA3      | ✅        | `guard.test.mjs`: exit 2 ao bloquear, exit 0 com JSON inválido; roda no `pnpm test` da raiz                                             |
| CA4      | ✅        | Arquivo temporário com `process.env` falhou no lint da API e do web (verificado manualmente); exceções com `off` nos 3 `eslint.config`  |
| CA5      | ✅        | `apps/api/src/env-consistency.test.ts` (server × runtimeEnv × globalEnv × `.env.example`, mapeamento e variável sobrando)               |
| CA6      | ✅        | `.claude/skills/nova-variavel-env/` e `nova-migration/`; citadas no `CLAUDE.md`                                                         |
| CA7      | ✅        | `helpers.test.ts`, `services/shared/errors.test.ts`, `http/app.test.ts` (validação em português)                                        |
| CA8      | ✅        | `docs/convencoes.md` (Idioma), ADRs 020 e 021, `docs/pendencias.md` (PF-008, 009 e 011 em Resolvidas)                                   |

## Comandos executados

| Comando                                      | Resultado                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test` | verde: 111 testes da API + 7 do hook (antes e depois dos ajustes da revisão) |

## Problemas encontrados

Revisão feita pelo subagente `revisor` (só análise estática).

- [média] `guard.mjs` — `.env.production.local` e curingas (`.env*`) passavam → corrigido no commit `d1f8b8d` (sufixo com pontos, curingas no lookahead, testes).
- [média] `guard.mjs` — `git switch -c x && git commit` na `main` era bloqueado (falso positivo) → corrigido em `d1f8b8d` (troca de branch no mesmo comando não decide); o inverso segue como limitação documentada na ADR 020.
- [média] `guard.mjs` — `echo git commit` bloqueava e `(git commit)` não → corrigido em `d1f8b8d` (`git` precisa ser o comando do trecho; ignora `(`, `&`, `sudo`, `env`). `git -C "dir com espaço"` segue sem tratamento: aceito, caso raro.
- [média] `guard.mjs` — texto de `git commit -m "... .env ..."` é bloqueado → aceito: documentado na ADR 020 e no `CLAUDE.md`; vale mais a regra simples que parsear aspas.
- [baixa] `guard.mjs` — `-C` relativo resolvido contra o cwd do hook → corrigido em `d1f8b8d`.
- [baixa] `guard.mjs` — guard de entrada falharia em silêncio com symlink → corrigido em `d1f8b8d` (`realpathSync`).
- [baixa] `guard.test.mjs` — teste do repositório real era quase tautológico → corrigido em `d1f8b8d` (repositório temporário com `git init -b main`).
- [baixa] `env-consistency.test.ts` — não conferia `runtimeEnv.X → process.env.X` nem variável sobrando no exemplo → corrigido em `d1f8b8d`. Dependência do formato do arquivo (4 espaços, `.default(` na mesma linha) aceita: o efeito é um falso erro, nunca um falso passe.
- [baixa] `http/app.ts` — `z.config` é global ao processo → aceito, comentado no código e na convenção (mensagens do `env`, validado antes, ficam em inglês).
- [baixa] `eslint.config` — o `off` desliga `no-restricted-properties` inteiro nos 3 arquivos exceção → aceito: hoje só há essa restrição.

## Riscos e limitações residuais

- O hook é regex, não sandbox: ofuscação (`$(echo .env)`) passa; ele só vale após carregar o `settings.json` (neste trabalho já estava ativo).
- Hook não cobre `cd outro && git commit` (avalia a branch do diretório original).
- Não rodei o `test:e2e` (nenhum service nem rota mudou de comportamento, só texto de mensagens).
