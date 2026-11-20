# Fluxo git: branch por demanda, squash merge

Vale para toda alteração de arquivos versionados.

## Branches

- **Nunca commite direto na `main`.** Toda demanda tem uma branch criada a partir da `main` atualizada.
- Nome: `<tipo>/<slug>`, com o mesmo slug da pasta `docs/workflows/<slug>/`.
  - `feat/` comportamento novo · `fix/` correção · `refactor/` estrutura sem mudar comportamento · `chore/` config, deps, tooling · `docs/` só documentação · `test/` só testes.
  - Slug em kebab-case, curto e descritivo: `feat/rota-status-ano`, `fix/post-sem-body`.
- Uma branch = uma demanda. Achou outro problema no caminho? Registre em `docs/pendencias.md` (rule `pending-fixes`), não misture.

## Commits na branch

- Um commit por **incremento** do `technical-plan.md`, sempre com o portão verde (`pnpm lint && pnpm check-types && pnpm test`).
- Conventional Commits em português: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Atualize o status do incremento no plano (com o hash) no mesmo commit ou no seguinte.
- Nunca `--no-verify`, nunca reescrever histórico já enviado (`push --force`) sem o usuário pedir.

## PR e merge

- A branch vai para a `main` por **PR com squash merge**: o título do PR vira o único commit na `main` (um pedido = um commit).
- Título do PR: Conventional Commit em português, ex.: `feat: rota de status do ano`.
- Abrir PR, fazer push e dar merge são ações externas: só com pedido explícito do usuário (skill `pr`, chamada por `/pr`).
- Depois do merge: `git switch main && git pull`, apague a branch local e marque a spec como `concluída`.
