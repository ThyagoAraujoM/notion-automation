# Revisão — Alternador de tema (dark/light) na landing page

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                    |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| CA1      | ✅        | `apps/web/components/theme-toggle.tsx` (fixo `top-4 right-4`, lua/sol, `aria-label`); conferido no navegador |
| CA2      | ✅        | clique alterna a classe `dark` e os ícones (conferido via DOM)                                               |
| CA3      | ✅        | `localStorage.theme` gravado e tema restaurado após recarregar                                               |
| CA4      | ✅        | script em `apps/web/app/layout.tsx` usa `prefers-color-scheme` sem escolha salva                             |
| CA5      | ✅        | script no `<head>` antes da pintura, `suppressHydrationWarning` só no `<html>`; sem erro de hidratação       |

Sem teste automatizado: o `apps/web` não tem runner (fora de escopo na spec).

## Comandos executados

| Comando                                       | Resultado                     |
| --------------------------------------------- | ----------------------------- |
| `pnpm lint && pnpm check-types && pnpm test`  | verde (API 138 testes, env 7) |
| Navegador: alternar, recarregar, mobile 375px | ok                            |

## Problemas encontrados

- [baixa] `apps/web/app/globals.css` — faltava `color-scheme` no tema escuro → corrigido no commit `350aadb`.
- [baixa] `apps/web/components/theme-toggle.tsx:24` — `aria-label` fixo, sem estado → aceito: rótulo dinâmico exigiria estado no cliente e reabriria o risco de hidratação.
- [baixa] `apps/web/components/theme-toggle.tsx:11` — o primeiro clique grava a escolha e não dá para voltar a seguir o sistema; mudança do sistema com a página aberta não é acompanhada → aceito: opção "sistema" está fora de escopo na spec.
- [baixa] ADR 013 de `docs/decisoes.md` ainda diz "squash merge" enquanto as regras mandam merge commit → fora do diff; não registrei PF (o ADR 013 pode já ter sido superado por outra decisão; confirmar).

## Riscos e limitações

- Sem teste automatizado do comportamento do tema; a verificação foi manual.
