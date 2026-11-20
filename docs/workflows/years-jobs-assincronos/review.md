# Revisão — Operações de ano assíncronas (202 + job + polling)

> Spec: [spec.md](./spec.md) · Plano: [technical-plan.md](./technical-plan.md)

- **Data:** 2026-11-20
- **Veredito:** ⚠️ pronto com ressalvas (nada bloqueante; ressalvas registradas em `PF-016`)

## Critérios de aceitação

| Critério | Atendido? | Evidência (teste, comando, arquivo)                                                                                                                                    |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA1      | ✅        | `years.test.ts`: "aceita com 202, jobId e Location..." (create, repair, delete); manual `DELETE /years/1990` → 202 + `Location`                                        |
| CA2      | ✅        | `years.test.ts`: 400 do Zod, "startToday fora do ano atual responde 400 na hora", "operação em andamento responde 409 na hora"; manual: 2º `DELETE /years/1992` → 409  |
| CA3      | ✅        | `years.test.ts` → `GET /years/jobs/:jobId` (running, concluído, 404, 400); manual `running` → `failed`/404                                                             |
| CA4      | ✅        | `years.test.ts`: jobs com 409/422/504/500 nas três rotas, sem "segredo interno" em `result`                                                                            |
| CA5      | ✅        | "responde antes de a operação terminar e só solta a trava no fim do job"; "falha ao finalizar o job ou ao gravar o log..."; mutação sem `release()` → 10 testes falham |
| CA6      | ✅        | `years.test.ts` → `operation_log` ("grava uma linha só, no fim do job"); manual: linhas com código final e duração                                                     |
| CA7      | ✅        | `db/year-job.test.ts` (`failInterruptedYearJobs`); chamada no boot em `http/server.ts`. A sequência de boot em si não é testada (código top-level)                     |
| CA8      | ✅        | 100 testes, sem Notion/Postgres e sem `setTimeout` (`settleYearJobs`)                                                                                                  |
| CA9      | ✅        | Swagger das rotas, `docs/arquitetura.md` (Operações em segundo plano), `docs/convencoes.md`, ADR 017, skill `criar-endpoint`, landing, `PF-001` resolvida              |

## Comandos executados

| Comando                                                                    | Resultado                          |
| -------------------------------------------------------------------------- | ---------------------------------- |
| `pnpm lint && pnpm check-types && pnpm test`                               | verde, 100 testes                  |
| `prisma migrate diff --from-config-datasource --to-schema ... --exit-code` | sem drift após `db:deploy`         |
| chamadas manuais na API local (ver Acompanhamento do plano)                | 202, polling, 400/409 síncronos ok |
| `test:e2e`                                                                 | não rodado: services não mudaram   |

## Problemas encontrados

Revisão do subagente `revisor`:

- [média] `apps/api/src/http/year-job.ts:65` — se `finishYearJob` falhar, o job fica `running` até o próximo boot → registrado como `PF-016`.
- [média] `apps/api/src/http/server.ts:9` — `onClose` desconecta o Prisma sem esperar os jobs; num restart o job fica `running` até o boot (que o corrige) → registrado como `PF-016`. Esperar os jobs no shutdown travaria o `tsx watch` por minutos, então pede um limite de tempo, decidido na pendência.
- [média] `failInterruptedYearJobs` sem teste → corrigido em `cb9bf21` (`db/year-job.test.ts`).
- [baixa] `GET /years/jobs/:jobId` sem 500 declarado → corrigido em `cb9bf21`.
- [baixa] `Location` não declarado como header no schema OpenAPI → aceito: a descrição de cada rota cita o header, e o teste confere o valor.
- [baixa] bloco `catch` e 202 repetidos nas três rotas → aceito: são três ocorrências explícitas e legíveis; extrair esconderia o status tipado de cada rota.
- [baixa] `apps/api/src/db/year-lock.ts:7` — o TTL deve continuar maior que o job → comentário adicionado em `cb9bf21`.
- [baixa] spec ainda `em revisão` → será marcada `concluída` no fluxo do `/pr`, na branch, antes do PR.
- [baixa] `settleYearJobs` exportado só para testes → aceito (documentado em `convencoes.md`; passa a ter uso real com a `PF-016`).

## Riscos residuais e limitações

- Contrato das três rotas mudou (200/201 → 202). Hoje não há consumidor programático além do Swagger.
- Se a API cair no meio de uma operação, ela para sem rollback; o job vira `failed` no boot e a mensagem indica `repair`/`DELETE`.
- Vale para uma instância da API só (ADR 017).
- `year_job` não tem limpeza automática.
