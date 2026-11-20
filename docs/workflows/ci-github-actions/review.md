# Revisão — CI no GitHub Actions

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (só ressalvas baixas; o CA5 se confirma no PR)

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                              |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `ci.yml`: `on: pull_request` e `push` na `main`, `permissions: contents: read`, `concurrency` com `cancel-in-progress` |
| CA2      | ✅        | passos `pnpm install --frozen-lockfile`, `lint`, `check-types`, `test`, `build`; nenhum secret nem `services:`         |
| CA3      | ✅        | os mesmos comandos passaram localmente (100 testes; build do web)                                                      |
| CA4      | ✅        | seção "CI" em `docs/convencoes.md`, ADR 018, linha no `CLAUDE.md`, `PF-002` em "Resolvidas"                            |
| CA5      | ⏳        | depende do push: conferir o check `Portão (lint, tipos, testes, build)` verde no PR e marcar na spec                   |

## Comandos executados

| Comando                                                           | Resultado                 |
| ----------------------------------------------------------------- | ------------------------- |
| `pnpm install --frozen-lockfile`                                  | ✅ (`prisma generate` ok) |
| `pnpm lint && pnpm check-types && pnpm test`                      | ✅ 100 testes             |
| `pnpm build`                                                      | ✅ web compila            |
| Subagente `revisor` sobre `main...HEAD` (leitura; não rodou o CI) | ⚠️ 5 baixas               |

## Problemas encontrados

- [baixa] `ci.yml` — actions por tag móvel (`@v4`) → aceito; fixar por SHA fica como endurecimento futuro.
- [baixa] `ci.yml` — o `pnpm build` depende de rede para as fontes do Next → risco já registrado na spec; se ficar instável, vira outro job.
- [baixa] spec `concluída` antes do CA5 → decisão: marcar `concluída` na branch (a regra pede) e ticar o CA5 em commit seguinte, após o primeiro run verde.
- [baixa] plano sem hash no incremento 3 → corrigido (`1fbef38`).
- [baixa] "primeiro run verde" para exigir o check → já descrito em `docs/convencoes.md`.

## Riscos residuais e limitações

- O CI só foi validado por leitura e pelos comandos locais; o primeiro run no GitHub é a prova real (CA5).
- A branch protection precisa ser ativada pelo usuário no GitHub.
