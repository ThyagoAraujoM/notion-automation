---
description: Revisa as mudanças pendentes com o agente revisor antes de commitar
argument-hint: "[foco opcional, ex.: segurança, rotas]"
---

Use o subagente **revisor** para revisar as mudanças pendentes do repositório (`git diff` e `git diff --staged`).

Foco extra pedido pelo usuário (se houver): $ARGUMENTS

Depois que o revisor responder:
1. Mostre o veredito e os problemas encontrados, do mais grave ao menos grave.
2. Pergunte se devo corrigir os problemas antes de commitar. Não corrija nem commite sem confirmação.
