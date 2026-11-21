# Revisão — Testes dos services e da trava por ano

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas

## Critérios de aceitação

| Critério | Atendido? | Evidência                                                                                                         |
| -------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `services/create-year.test.ts` (existe, vínculos, conteúdo, template, rollback, template faltando)                |
| CA2      | ✅        | `services/repair-year.test.ts` (ano inexistente, completo, só o ano, dia sumido, religa dia, semana e mês)        |
| CA3      | ✅        | `services/delete-year.test.ts` (inexistente, ordem e contagens, não toca em outro ano)                            |
| CA4      | ✅        | `db/year-lock.test.ts`, `services/shared/year-lock.test.ts`                                                       |
| CA5      | ✅        | `db/year-lock.integration.test.ts`: `pnpm --filter=@notion-automation/api test:integration` 5/5 no Postgres local |
| CA6      | ✅        | portão verde; `docs/convencoes.md`, `CLAUDE.md`, ADR 018 e `PF-006` em "Resolvidas"                               |

## Comandos executados

| Comando                                                 | Resultado                                   |
| ------------------------------------------------------- | ------------------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test`            | verde, 138 testes                           |
| `pnpm --filter=@notion-automation/api test:integration` | 5/5 passaram                                |
| `test:e2e`                                              | não rodado: nenhum código de produção mudou |

## Problemas encontrados

- [média] `test-utils/fake-notion.ts` ignorava `template` → corrigido no `bea12c1` (guarda e os testes conferem o template de cada página e o padrão do ano).
- [média] `create-year.test.ts` conferia vínculos de forma fraca → corrigido no `bea12c1` (recorte 25/set cruza mês e trimestre; compara com o plano).
- [média] propriedades de conteúdo sem asserção → corrigido no `bea12c1` (`Dia Nº`, `Data`, `Nº do mês`, `Semana nº`, nome).
- [média] `repairYear` só testava religação de dias → corrigido no `bea12c1` (semana e mês).
- [média] fake aceitava lixeira repetida → corrigido no `bea12c1` (lança erro, como o Notion real).
- [baixa] rollback sem caso de falha na lixeira → corrigido no `bea12c1`.
- [baixa] integração sem guarda de host → corrigido no `bea12c1` (só roda em localhost).
- [baixa] fake não pagina → aceito: paginação coberta em `helpers.test.ts` e no E2E; limite documentado no cabeçalho do fake.
- [baixa] teste de corrida prova a chave primária, não a sobreposição real das conexões → aceito.
- [baixa] texto da mensagem em `year-lock.test.ts` e ordem "não decrescente" da lixeira → aceitos (mensagem é contrato com o usuário; ordem cobre a regressão relevante).
- [baixa] helpers de leitura duplicados nos testes → aceito, diff pequeno.
- O revisor apontou `test-utils/` sem doc em `convencoes.md`, mas a seção "Testar service" já a descreve.

## Riscos e limitações

- O fake não valida nomes de colunas contra o schema real; o contrato fica em `year-pages.test.ts` e no E2E.
- A integração roda só localmente (fora do CI); para o CI falta `services: postgres` e `db:deploy`.
