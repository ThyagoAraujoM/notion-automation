# Alternador de tema (dark/light) na landing page

- **Slug:** `toggle-tema-web`
- **Tipo:** feature
- **Status:** em revisão
- **Branch:** `feat/toggle-tema-web`
- **PR:** —
- **Criada em:** 2026-11-20

## Objetivo

Resolver a PF-012: dar à landing page (`apps/web`) um botão com ícone, no canto superior direito, que alterna entre tema claro e escuro.

## Contexto

O dark mode do shadcn é por classe (`.dark`, `apps/web/app/globals.css`) e não havia como ativá-lo; a página ficava sempre clara (ADR do `docs/decisoes.md`, "Consequências").

## Critérios de aceitação

- [x] **CA1** — Há um botão fixo no canto superior direito, com ícone de lua no tema claro e de sol no escuro, e `aria-label` em português.
- [x] **CA2** — Clicar alterna a classe `dark` no `<html>` e o ícone muda.
- [x] **CA3** — A escolha persiste em `localStorage` e vale ao recarregar.
- [x] **CA4** — Sem escolha salva, segue `prefers-color-scheme`.
- [x] **CA5** — Sem flash de tema errado no carregamento (classe aplicada antes da hidratação) e sem erro de hidratação.

## Fora de escopo

- Opção "sistema" explícita (três estados) e dependência `next-themes`.
- Testes automatizados do web (o app não tem runner de testes).

## Riscos e dúvidas em aberto

- `localStorage` pode estar bloqueado: o código usa try/catch e cai no tema do sistema.
