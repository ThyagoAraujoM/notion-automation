---
name: bugfix
description: Corrige um defeito com reprodução primeiro — branch fix/<slug>, teste que falha mostrando o bug, causa raiz, menor correção, teste de regressão, portão e revisão. Use quando algo que deveria funcionar não funciona (erro, status HTTP errado, dado errado no Notion, regressão).
argument-hint: "[descrição do bug ou mensagem de erro]"
---

# Correção de bug

## Propósito

Corrigir a **causa** de um defeito com a menor mudança possível, provando com um teste que falhava antes e passa depois, para o bug não voltar.

## Quando usar

O comportamento atual diverge do esperado ou documentado. Se o "bug" for na verdade um comportamento novo desejado, use `feature`. Se a causa for desconhecida e as tentativas não convergem, pare na etapa 4 e investigue antes de mudar código.

## Entradas

- Relato: `$ARGUMENTS` (mensagem de erro, status, passos, dados).
- Comportamento esperado: docs (`docs/arquitetura.md`, Swagger em `/docs`), spec da feature original em `docs/workflows/`, testes existentes.
- Comandos: `pnpm lint && pnpm check-types && pnpm test`; `test:e2e` se envolver o Notion.

## Etapas

1. **Prepare a branch.** `git switch main && git pull` (se houver remoto) e `git switch -c fix/<slug>`.
2. **Registre o bug.** Crie `docs/workflows/<slug>/spec.md` pelo template (formato bugfix: comportamento atual, comportamento esperado, como reproduzir, critério de aceitação = "o caso X passa a dar Y"). Plano curto em `technical-plan.md` (pode ter um único incremento).
3. **Reproduza com um teste que falha.** Escreva o teste unitário (ou de rota via `app.inject()`) que mostra o defeito e **rode para ver falhar** pelo motivo certo. Se não for reproduzível em teste, registre os passos manuais exatos.
4. **Encontre a causa raiz.** Leia o código do caminho que falha; explique por que acontece (`caminho:linha`). Não corrija o sintoma (ex.: `try/catch` engolindo erro) sem entender a causa.
5. **Corrija com a menor mudança.** Rode o teste da etapa 3 (agora passa) e o portão completo.
6. **Procure o mesmo padrão** em outros lugares (mesma função usada em outras rotas, mesmo erro de lógica). Corrija só o que está no escopo; o resto vira `PF-NNN`.
7. **Atualize docs** se o comportamento documentado estava errado ou se a regra que evita o bug deve virar convenção (ex.: `.nullish()` em body opcional).
8. **Commit** (`fix: ...`), spec `em revisão`, e chame a skill `review`.

## Pontos de decisão

- Não reproduz: colete mais evidência (logs da API, `pnpm dev`, resposta exata) antes de mudar qualquer coisa.
- Duas tentativas de correção sem efeito: pare, liste hipóteses descartadas e consulte o usuário ou o advisor.
- A correção muda contrato público (status, formato de resposta): trate como `feature` ou alinhe com o usuário.
- Bug em dado já gravado no Notion/Postgres: a correção de código não conserta o dado; planeje o reparo (ex.: `POST /years/:year/repair`) e peça autorização antes de escrever.

## Quality gates

- Existe teste que falhava antes da correção e passa depois (ou justificativa + passo manual).
- Causa raiz explicada no plano.
- Portão verde; diff mínimo; padrões iguais registrados como pendências.

## Critério de saída

Defeito corrigido na branch `fix/<slug>`, teste de regressão no lugar, `review` com veredito ✅ ou ⚠️.

## Handoff

Informe: pasta da demanda, branch, causa raiz, teste de regressão (arquivo e nome), arquivos alterados, comandos e resultados, `PF-NNN` registrados e próxima rota (`review` → `/pr`).
