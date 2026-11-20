---
name: feature
description: Implementa uma feature nova (ou amplia um comportamento existente) do início ao PR — branch feat/<slug>, spec e plano em docs/workflows/<slug>/, incrementos pequenos com testes e um commit cada, portão de qualidade, docs e revisão. Use quando o usuário pedir uma nova capacidade, rota, campo ou comportamento.
argument-hint: "[descrição da feature]"
---

# Implementação de feature

## Propósito

Entregar um comportamento novo em incrementos pequenos, verificáveis e coerentes com os contratos da aplicação, numa branch própria, pronto para PR.

## Quando usar

Pedido de capacidade nova ou ampliação de comportamento existente. Se o comportamento atual estiver **errado**, use `bugfix`. Se faltarem critérios implementáveis, a etapa 1 chama `spec-authoring`. Para criar rota HTTP, siga também a skill `criar-endpoint` dentro dos incrementos.

## Entradas

- Pedido: `$ARGUMENTS`; objetivo, critérios de aceitação e fora de escopo.
- `docs/workflows/<slug>/spec.md` e `technical-plan.md`.
- `CLAUDE.md`, `docs/arquitetura.md`, `docs/convencoes.md` e as rules em `.claude/rules/`.
- Comandos de validação do projeto: `pnpm lint && pnpm check-types && pnpm test` (raiz); `pnpm --filter=@notion-automation/api test:e2e` quando mexer em services/Notion (só com autorização do usuário: escreve no Notion real).

## Etapas

1. **Prepare a branch.** Partindo da `main` atualizada e sem alterações pendentes: `git switch main && git pull` (se houver remoto) e `git switch -c feat/<slug>` (ou `<tipo>/<slug>` com o tipo da spec, quando a demanda for `chore`, `refactor`, `docs` ou `test` e seguir este mesmo fluxo). Se já estiver na branch da demanda, continue nela.
2. **Materialize a demanda.** Crie ou atualize `spec.md` e `technical-plan.md` com a skill `spec-authoring` antes de alterar código.
3. **Confirme a intenção.** Compare os artefatos com o pedido e o código atual; resolva divergências que mudem o escopo com o usuário.
4. **Proteja os contratos.** Identifique o que muda para quem consome: rotas e status HTTP, schemas Zod, variáveis de ambiente (`packages/env` + `turbo.json` + `.env.example`), propriedades do Notion, tabelas do Prisma (migration). Registre compatibilidade e reversão no plano.
5. **Para cada incremento do plano, nesta ordem:**
   1. Escreva ou atualize os **testes unitários** que expressam o critério (caminho principal, limites, entrada inválida, erros). Siga `docs/convencoes.md#testes`: `*.test.ts` ao lado do código, rota via `app.inject()`, Notion/Prisma mockados.
   2. Faça a **menor alteração** que faz os testes passarem.
   3. Rode o teste específico (`pnpm --filter=@notion-automation/api test -- <arquivo>`) e depois o portão completo.
   4. Revise o próprio diff (`git diff`): nada incidental, nada fora do escopo.
   5. Atualize o status do incremento no plano e faça **um commit** (Conventional Commit em português).
6. **Integre o fluxo.** Com todos os incrementos feitos, valide a interação entre eles e com os consumidores. Mexeu em services ou no Notion: **peça autorização** e rode o `test:e2e` (escreve no Notion real, cria e apaga o ano 2090, ~5 min). Mexeu em rota: suba a API e chame a rota de verdade (descreva os passos para o usuário repetir).
7. **Atualize o conhecimento** (docs vivas): `docs/arquitetura.md` (rotas, fluxo), `docs/convencoes.md`, `docs/decisoes.md`, skills e agentes que descrevem o padrão alterado, e o `.env.example`.
8. **Prepare a revisão.** Spec com status `em revisão`, critérios marcados, e chame a skill `revisar`.

## Pontos de decisão

- Critério ambíguo: pare e use `spec-authoring`.
- Evidência de regressão (algo que funcionava quebrou): reclassifique como `bugfix`.
- Contrato compartilhado mudou: valide produtores e consumidores (rota ↔ web, env ↔ docker-compose, Prisma ↔ migrations).
- Falha que se repete sem evidência nova: pare, descreva o que já tentou e peça ajuda ao usuário (ou consulte o advisor).
- Um gate não pode ser executado (ex.: Notion fora, permissão negada): registre o motivo, a validação alternativa e o risco no plano e no `review.md`.
- Problema fora do escopo: registre em `docs/pendencias.md` (rule `pending-fixes`); não amplie o diff.
- Comportamento não isolável em teste unitário: registre o motivo e a verificação substituta (integração, E2E ou passo manual reproduzível).

## Quality gates

- Todos os critérios de aceitação atendidos ou explicitamente pendentes.
- `spec.md` e `technical-plan.md` refletem o estado atual.
- Cada incremento tem testes novos ou atualizados (ou justificativa registrada), e esses testes falhariam sem a mudança.
- `pnpm lint && pnpm check-types && pnpm test` passa na raiz.
- O diff contém só mudanças necessárias; docs e contratos afetados atualizados.
- Pendências encontradas e não corrigidas registradas com `PF-NNN`.

## Critério de saída

Comportamento implementado na branch `feat/<slug>` (ou `<tipo>/<slug>`), um commit por incremento, artefatos atualizados, portão verde e a skill `revisar` com veredito ✅ ou ⚠️.

## Handoff

Informe: pasta da demanda, branch, objetivo, critérios atendidos, arquivos e contratos alterados, testes criados/atualizados, comandos e resultados, decisões, limitações, IDs `PF-NNN` registrados e próxima rota (`revisar` → `/pr`). Se pausar no meio, preencha `docs/workflows/<slug>/handoff.md` a partir de [../spec-authoring/templates/handoff.md](../spec-authoring/templates/handoff.md).
