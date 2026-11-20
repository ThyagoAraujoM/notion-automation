## Resumo

<!-- O que muda e por quê, em 2–3 frases. O título do PR aparece no commit de merge: use Conventional Commit em português. -->

**Demanda:** [`docs/workflows/<slug>/`](../docs/workflows/<slug>/) · **Tipo:** feature | bugfix | chore | refactor

## Critérios de aceitação

<!-- Copie da spec, com a evidência de cada um (teste, comando, arquivo). -->

- [ ] CA1 — ... (evidência: ...)

## Como testar

<!-- Passos que qualquer pessoa consegue repetir. -->

```powershell
pnpm lint && pnpm check-types && pnpm test
```

## Contratos e riscos

<!-- Rotas, status HTTP, variáveis de ambiente, propriedades do Notion, migrations. Riscos residuais do review.md. -->

## Pendências registradas

<!-- IDs PF-NNN criados em docs/pendencias.md, ou "nenhuma". -->

## Checklist

- [ ] Portão verde (`pnpm lint && pnpm check-types && pnpm test`)
- [ ] `review.md` com veredito ✅ ou ⚠️
- [ ] Docs, skills e `.env.example` atualizados quando o padrão mudou
- [ ] Commits da branch com mensagens claras (todos vão para a main)
- [ ] Merge por **Create a merge commit**
