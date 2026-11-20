# Plano técnico — <Título da demanda>

> Spec: [spec.md](./spec.md)

## Abordagem

Como a solução funciona, em poucas linhas. Alternativas descartadas e por quê (se a escolha for estrutural, registre também em `docs/decisoes.md`).

## Arquivos e contratos afetados

| Arquivo / contrato | Mudança |
| ------------------ | ------- |
| `apps/api/src/...` | ...     |

Contratos públicos (rotas, schemas, variáveis de ambiente, nomes de propriedades do Notion): o que muda para quem consome? Precisa de migração ou compatibilidade?

## Incrementos

Cada incremento é pequeno, deixa o projeto verde (lint, tipos, testes) e vira **um commit na branch**.

| #   | Mudança | Testes previstos | Critérios | Pronto quando | Status |
| --- | ------- | ---------------- | --------- | ------------- | ------ |
| 1   | ...     | ...              | CA1       | ...           | ⬜     |

Status: ⬜ pendente · 🔄 em andamento · ✅ feito (com o hash do commit)

## Validação

- Portão: `pnpm lint && pnpm check-types && pnpm test`
- Específico: ... (ex.: teste de rota, `test:e2e`, chamada manual à API)
- Verificação substituta, quando não houver teste automatizado: ...

## Reversão

Como desfazer se der errado depois do merge (ex.: reverter o commit do squash; migration de volta; dados no Notion).

## Acompanhamento

Anotações datadas de decisões e descobertas durante a implementação.

- AAAA-MM-DD — ...
