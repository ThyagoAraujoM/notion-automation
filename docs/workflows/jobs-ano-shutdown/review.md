# Revisão — Jobs de ano no shutdown (PF-016)

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (nada bloqueante; falta a conferência manual com Ctrl+C num job real)

## Critérios de aceitação

| Critério | Atendido? | Evidência (teste, comando, arquivo)                                                                                                                                   |
| -------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `year-job.test.ts`: "marca os jobs em andamento como falhos e solta as travas…"; `server.ts` (handlers de sinal, `onClose` antes do `$disconnect`) sem teste unitário |
| CA2      | ✅        | `db/year-job.test.ts`: `failYearJobs` filtra `status: "running"` e ids informados                                                                                     |
| CA3      | ✅        | `year-job.test.ts`: "retenta e para quando uma tentativa dá certo" e "esgotadas as tentativas, marca o job como failed"                                               |
| CA4      | ✅        | `failInterruptedYearJobs` e `clearYearLocks` no boot continuam (`server.ts`, `db/year-job.test.ts`)                                                                   |

## Comandos executados

| Comando                                      | Resultado                                                 |
| -------------------------------------------- | --------------------------------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test` | verde (146 testes no API)                                 |
| Ctrl+C durante um job real                   | **não feito** (escreve no Notion; precisa de autorização) |

## Problemas encontrados

Revisão do subagente `revisor`:

- [média] `year-job.ts` — janela entre obter a trava/criar o job e registrá-lo no mapa: um sinal nesse intervalo (milissegundos) deixa o job `running` até o boot → aceito: mesmo bug da PF-016, só que raríssimo, coberto pelo CA4; documentado em `docs/arquitetura.md`.
- [média] `server.ts` — shutdown sem prazo e segundo sinal ignorado → corrigido em `a1c9d0e` (prazo de 10 s com `unref`; segundo sinal força a saída).
- [média] `year-job.ts` — trava solta duas vezes (shutdown e fim do job) → corrigido em `a1c9d0e` (`release` idempotente, com teste).
- [baixa] job que termina após o shutdown sobrescreve o `failed` de interrupção → aceito (é o desfecho real); comentário adicionado em `a1c9d0e`.
- [baixa] log do `onClose` sem os ids dos jobs afetados → aceito: o erro já vai ao log e o boot corrige.
- [baixa] Windows só entrega `SIGINT` → documentado em `docs/arquitetura.md`.

## Riscos residuais e limitações

- Handlers de sinal do `server.ts` sem teste automatizado (arquivo de boot); só a conferência manual cobre o fluxo completo.
- Vale para uma instância da API (ADR 017). `kill -9`, crash e fechar o terminal no Windows caem no boot.
- `year_job` não tem limpeza automática.
