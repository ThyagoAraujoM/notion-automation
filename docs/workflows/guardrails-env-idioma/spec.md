# Guard-rails automáticos, checagem do env e política de idioma

- **Slug:** `guardrails-env-idioma`
- **Tipo:** chore
- **Status:** em andamento
- **Branch:** `chore/guardrails-env-idioma`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Resolver `PF-008`, `PF-009` e `PF-011` numa demanda só (três incrementos): trocar regras que dependem de a IA lembrar por verificação automática (hook e lint/teste) e fixar a política de idioma do projeto.

## Contexto

- `PF-008`: nada impede `git commit` na `main` nem ler o `.env` por shell (o `deny` do `settings.json` cobre só Read/Edit).
- `PF-009`: nada confere `process.env` fora de `packages/env` nem a consistência entre `packages/env/index.ts`, `turbo.json` (`globalEnv`) e `.env.example`.
- `PF-011`: mensagens misturam português e rótulos em inglês (`MissingTemplatesError` usa `quarter:`, `week:`; a trava mostra `createYear`; a validação mostra `body.year` e textos do Zod em inglês).
- **Decisão do usuário (2026-11-20):** identificadores (variáveis, funções, arquivos, chaves JSON) em inglês; comentários de código em português; descrições da API (Swagger) e mensagens em português por ora. A API é internacional e a documentação será multilíngue no futuro, mas hoje só há português.

## Critérios de aceitação

- [ ] **CA1** — Hook `PreToolUse` (Bash e PowerShell) bloqueia `git commit` quando a branch atual é `main`, em qualquer forma (`git -C x commit`).
- [ ] **CA2** — O mesmo hook bloqueia comandos que leem `.env` e `.env.*`, mas permite `.env.example`, `process.env` e `packages/env`.
- [ ] **CA3** — O hook falha aberto (exit 0) com entrada inválida; bloqueio é exit 2 com mensagem em stderr. Há teste automatizado.
- [ ] **CA4** — `process.env` fora de `packages/env/index.ts` (e das exceções `apps/api/prisma.config.ts`, `apps/web/scripts/dev.mjs`) faz o `pnpm lint` falhar.
- [ ] **CA5** — Teste em `apps/api` falha se uma variável estiver em `server`/`runtimeEnv`/`globalEnv`/`.env.example` e faltar em outro.
- [ ] **CA6** — Skills `nova-variavel-env` e `nova-migration` existem e estão citadas no CLAUDE.md.
- [ ] **CA7** — Mensagens de erro da API saem inteiras em português: 422 de templates (`trimestre`, `mês`, `semana`, `dia`), trava (`criação do ano`...), validação (rótulos e textos do Zod via locale `pt`). Chaves JSON e identificadores seguem em inglês.
- [ ] **CA8** — Política de idioma em `docs/convencoes.md` e ADR; `PF-008`, `PF-009`, `PF-011` em "Resolvidas".

## Fora de escopo

- i18n real (várias línguas na documentação/mensagens): fica para quando houver segundo idioma.
- Renomear identificadores: já estão em inglês.
- Hook para outros comandos perigosos (push, reset).

## Riscos e dúvidas em aberto

- Hooks só valem após reiniciar a sessão do Claude Code; a verificação aqui é por teste do script.
- `.env.example` é coberto pelo `deny` de leitura da IA: o teste dele roda no Vitest (que lê o arquivo), mas a IA não consegue inspecioná-lo.
- Um hook por regex não é à prova de ofuscação (`$(echo .env)`); é uma rede de segurança, não um sandbox.
