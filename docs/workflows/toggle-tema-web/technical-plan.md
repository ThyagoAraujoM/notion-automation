# Plano técnico — Alternador de tema

> Spec: [spec.md](./spec.md)

## Abordagem

Sem dependência nova. Um script inline no `<head>` aplica a classe `dark` antes da pintura (lê `localStorage`, senão `prefers-color-scheme`). O componente cliente `ThemeToggle` renderiza os dois ícones e deixa o CSS (`dark:`) escolher qual aparece, o que evita divergência de hidratação; ao clicar, alterna a classe e grava a escolha. `next-themes` foi descartado: o caso é simples demais para justificar a dependência.

## Arquivos e contratos afetados

| Arquivo / contrato                       | Mudança                                                        |
| ---------------------------------------- | -------------------------------------------------------------- |
| `apps/web/components/theme-toggle.tsx`   | novo botão (ícones lucide `Moon`/`Sun`)                        |
| `apps/web/app/layout.tsx`                | script anti-flash, `suppressHydrationWarning`, renderiza botão |
| `docs/decisoes.md`, `docs/pendencias.md` | ADR atualizado; PF-012 resolvida                               |

Sem contratos públicos afetados (só front).

## Incrementos

| #   | Mudança                      | Testes previstos                                    | Critérios | Pronto quando                       | Status       |
| --- | ---------------------------- | --------------------------------------------------- | --------- | ----------------------------------- | ------------ |
| 1   | Componente, script e layout  | verificação manual no navegador (sem runner no web) | CA1–CA5   | portão verde e conferido no browser | ✅ `b9f18ba` |
| 2   | Docs (ADR, PF-012 resolvida) | —                                                   | —         | docs coerentes                      | ✅ `b9f18ba` |

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`
- Substituta: `pnpm dev --filter=web`, clicar no botão, recarregar, emular `prefers-color-scheme`.

## Reversão

`git revert -m 1 <merge>`.

## Acompanhamento

- 2026-11-20 — Conferido no navegador: alterna, persiste ao recarregar, mobile ok. Bug achado: constante exportada de módulo `"use client"` virou referência no layout (servidor); movida para `apps/web/lib/theme.ts`.
- 2026-11-20 — Revisão: `color-scheme` corrigido em `350aadb`. Os incrementos 1 e 2 entraram num commit só.
- 2026-11-20 — Web sem runner de testes: validação manual registrada aqui.
