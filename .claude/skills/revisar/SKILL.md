---
name: revisar
description: Revisa a demanda atual antes do PR — roda o portão, delega a revisão do diff ao subagente revisor (contexto isolado), confere os critérios de aceitação da spec e grava docs/workflows/<slug>/review.md com veredito. Use ao terminar uma feature ou bugfix, antes de commitar algo grande, ou quando o usuário pedir revisão (/revisar).
argument-hint: "[foco opcional, ex.: segurança, rotas]"
---

# Revisão da demanda

## Propósito

Ter um segundo olhar **independente** sobre a mudança antes do PR e deixar registrado o que foi verificado, o que foi corrigido e o que ficou de risco.

## Quando usar

Última etapa de `feature` e `bugfix`, ou a pedido do usuário. Foco extra pedido: `$ARGUMENTS`.

## Entradas

- Branch atual e o diff contra a `main`: `git diff main...HEAD` e alterações não commitadas.
- `docs/workflows/<slug>/spec.md` e `technical-plan.md` (identifique o slug pelo nome da branch).
- Template: [../spec-authoring/templates/review.md](../spec-authoring/templates/review.md).

## Etapas

1. **Rode o portão** na raiz: `pnpm lint && pnpm check-types && pnpm test`. Falhou: volte para a skill de origem; não revise código quebrado.
2. **Delegue a revisão do código ao subagente `revisor`**. Passe: o comando do diff (`git diff main...HEAD`), os arquivos da demanda, o foco extra e o que já foi verificado. **Não** passe a sua conclusão: o valor dele é não estar ancorado no que você pensou.
3. **Confira os critérios.** Para cada `CAn` da spec, aponte a evidência (teste, comando, arquivo). Critério sem evidência = problema.
4. **Trate os achados.** Para cada problema do revisor, decida: corrigir agora (commit na branch, rodando o portão de novo), registrar como `PF-NNN` (fora do escopo) ou aceitar com justificativa. Não ignore em silêncio.
5. **Grave `review.md`** em `docs/workflows/<slug>/` a partir do template: veredito, critérios, comandos com resultado, problemas e destino de cada um, riscos residuais.
6. **Mostre ao usuário** o veredito e os problemas, do mais grave ao menos grave. Pergunte antes de corrigir algo que mude escopo.

## Pontos de decisão

- Veredito ❌: não siga para PR; volte para `feature`/`bugfix` com a lista de correções.
- Achado de segurança (segredo no código, `.env` versionado, token em log): sempre corrigir antes do PR.
- Revisor discorda da spec: a spec pode estar errada; leve ao usuário em vez de escolher sozinho.

## Quality gates

- Portão verde na hora da revisão.
- Revisão feita pelo subagente `revisor`, não pela própria sessão que implementou.
- Todo critério com evidência; todo achado com destino (corrigido / `PF-NNN` / aceito).
- `review.md` gravado e commitado na branch.

## Critério de saída

`review.md` com veredito ✅ ou ⚠️ commitado na branch; spec `em revisão`.

## Handoff

Informe: veredito, problemas e destino de cada um, riscos residuais e a próxima rota: `/pr` (o usuário dispara) ou voltar para `feature`/`bugfix`.
