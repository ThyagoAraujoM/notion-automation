# Fluxo git: branch por demanda, merge commit

Vale para toda alteração de arquivos versionados.

## Branches

- **Nunca commite direto na `main`.** Toda demanda tem uma branch criada a partir da `main` atualizada.
- Nome: `<tipo>/<slug>`, com o mesmo slug da pasta `docs/workflows/<slug>/`.
  - `feat/` comportamento novo · `fix/` correção · `refactor/` estrutura sem mudar comportamento · `chore/` config, deps, tooling · `docs/` só documentação · `test/` só testes.
  - Slug em kebab-case, curto e descritivo: `feat/rota-status-ano`, `fix/post-sem-body`.
- Uma branch = uma demanda. Achou outro problema no caminho? Registre em `docs/pendencias.md` (rule `pending-fixes`), não misture.

## Commits na branch

- Um commit por **incremento** do `technical-plan.md`, sempre com o portão verde (`pnpm lint && pnpm check-types && pnpm test`).
- **Todo commit da branch vai para a `main` como está** (merge commit), então cada um precisa se sustentar sozinho: portão verde, mensagem que explica a mudança, sem commits de "wip", "ajuste" ou "fixup". Correção pedida na revisão vira um commit próprio (`fix: ...`), para ficar rastreável.
- Conventional Commits em português: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Atualize o status do incremento no plano (com o hash) no mesmo commit ou no seguinte.
- Nunca `--no-verify`, nunca reescrever histórico já enviado (`push --force`) sem o usuário pedir.

## PR e merge

- A branch vai para a `main` por **PR com merge commit** (botão padrão "Create a merge commit"): os commits da branch entram na `main` um a um, agrupados pelo commit de merge (um pedido = um merge). Assim dá para rastrear em qual commit cada modificação foi feita. Não use squash nem rebase.
- Título do PR: Conventional Commit em português, ex.: `feat: rota de status do ano`. Ele aparece no commit de merge e na lista de PRs.
- Visão resumida da `main` (uma linha por demanda): `git log --first-parent --oneline main`.
- Abrir PR, fazer push e dar merge são ações externas: só com pedido explícito do usuário (skill `pr`, chamada por `/pr`).
- A spec é marcada `concluída` (e as pendências resolvidas são movidas) **na branch, antes do PR**: o merge leva isso para a `main`. Depois do merge só sobra `git switch main && git pull` e `git branch -d <branch>`, com o PR confirmado como `MERGED`.
