---
name: spec-authoring
description: Escreve ou atualiza a spec (spec.md) e o plano técnico (technical-plan.md) de uma demanda em docs/workflows/<slug>/, com critérios de aceitação verificáveis e incrementos pequenos. Use antes de implementar uma feature ou bugfix, quando o pedido não tiver critérios claros, ou quando o usuário pedir para planejar/especificar algo.
argument-hint: "[descrição da demanda ou slug existente]"
---

# Spec e plano técnico

## Propósito

Transformar um pedido em artefatos implementáveis: o **quê** (spec: objetivo, critérios de aceitação, fora de escopo) e o **como** (plano: abordagem, arquivos, incrementos, validação), antes de qualquer código.

## Quando usar

- Primeira etapa das skills `feature` e `bugfix`.
- Pedido ambíguo, grande ou que mexe em contrato público (rota, schema, variável, propriedade do Notion).
- Não use para mudança trivial de uma linha sem decisão (vá direto ao `bugfix`/`feature` com spec mínima).

## Entradas

- O pedido do usuário: `$ARGUMENTS`.
- Contexto: `CLAUDE.md`, `docs/arquitetura.md`, `docs/convencoes.md`, `docs/decisoes.md`, `docs/pendencias.md`.
- Código atual dos módulos afetados (delegue a busca ao subagente `explorador` se for ampla).
- Templates desta skill: [templates/spec.md](templates/spec.md), [templates/technical-plan.md](templates/technical-plan.md).

## Etapas

1. **Defina o slug** (kebab-case, curto) e o tipo (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`). Se já existe `docs/workflows/<slug>/`, atualize em vez de recriar.
2. **Leia o contexto** necessário: o que existe hoje, contratos afetados, decisões anteriores e pendências relacionadas (`PF-NNN`).
3. **Escreva `spec.md`** a partir do template: objetivo, contexto com `caminho:linha`, critérios de aceitação numerados (`CA1`...) e verificáveis, fora de escopo, riscos. Status `rascunho`.
4. **Pergunte o que só o usuário decide.** Se um critério depende de escolha de produto ou de contrato, pergunte (uma vez, com opções e recomendação) em vez de supor.
5. **Escreva `technical-plan.md`**: abordagem e alternativas descartadas, arquivos e contratos afetados, incrementos pequenos (cada um com testes previstos, critérios atendidos e condição de pronto), validação e reversão.
6. **Confira a coerência**: todo critério aparece em pelo menos um incremento; todo incremento tem teste previsto ou verificação substituta justificada; nada do fora de escopo aparece no plano.
7. **Mude o status** para `em andamento` quando o usuário aprovar (ou quando o pedido já tiver aprovação explícita) e devolva para a skill que chamou.

## Pontos de decisão

- Faltam informações que mudam o escopo: pergunte antes de continuar.
- Escolha estrutural (padrão novo, dependência nova, mudança de contrato): registre também em `docs/decisoes.md` (ADR).
- Demanda grande demais (mais de ~6 incrementos ou várias áreas sem dependência): proponha dividir em demandas separadas.
- Pedido é na verdade um defeito do comportamento atual: use o formato de bugfix (comportamento atual / esperado / como reproduzir).

## Quality gates

- `spec.md` e `technical-plan.md` existem em `docs/workflows/<slug>/` e seguem os templates.
- Critérios de aceitação são verificáveis (por teste, comando ou passo manual reproduzível).
- Cada incremento deixa o projeto verde sozinho.
- Fora de escopo está explícito.

## Critério de saída

Spec e plano aprovados (ou aprovação explícita no pedido), status `em andamento`, branch definida no cabeçalho da spec.

## Handoff

Informe: caminho da pasta, slug, branch sugerida, critérios, incrementos e perguntas pendentes. Próxima rota: `feature` ou `bugfix`.
