# Decisões (ADRs leves)

> Registro do **porquê** das escolhas. Cada decisão: contexto, decisão, alternativas, consequências.
> Ajuda o Claude (e você no futuro) a não "desfazer" escolhas conscientes.

## Modelo

```md
## NNN — Título curto

- **Data:** AAAA-MM-DD
- **Status:** proposta | aceita | substituída por NNN
- **Contexto:** qual problema estávamos resolvendo
- **Decisão:** o que escolhemos
- **Alternativas:** o que mais foi considerado e por que não
- **Consequências:** o que fica mais fácil / mais difícil
```

---

## 001 — Monorepo com Turborepo + pnpm

- **Status:** aceita
- **Contexto:** API e front no mesmo projeto, compartilhando env, configs e UI.
- **Decisão:** Turborepo + pnpm workspaces.
- **Alternativas:** _preencher_
- **Consequências:** _preencher_

## 002 — Fastify + Zod na API

- **Status:** aceita
- **Contexto:** _preencher_
- **Decisão:** Fastify 5 com `fastify-type-provider-zod` para tipar e validar rotas.
- **Alternativas:** _preencher (Express? Hono? NestJS?)_
- **Consequências:** _preencher_

## 003 — Um database do Notion por nível

- **Status:** aceita
- **Contexto:** Ano, Trimestre, Mês, Semana e Dia têm propriedades diferentes.
- **Decisão:** cada nível tem seu próprio database; IDs nas variáveis `*_DATABASE_ID` (antes `*_TOKEN`; ver 010).
- **Alternativas:** _preencher_
- **Consequências:** _preencher_

## 004 — Portas separadas para API e Web

- **Status:** aceita
- **Contexto:** ambos usavam a porta 3000 e conflitavam no `pnpm dev`.
- **Decisão:** `PORT_BACKEND` (4000) e `PORT_FRONTEND` (3000) no `packages/env`.
- **Consequências:** o `web` usa `scripts/dev.mjs` para repassar a porta ao `next dev`.

## 005 — PostgreSQL com Prisma 7, rodando no Docker

- **Data:** 2026-11-15
- **Status:** aceita
- **Contexto:** `DATABASE_URL` existia sem uso (substituída por `POSTGRES_USER/PASSWORD/DB/PORT` separadas); queremos registrar o retorno das rotas de criar e apagar ano.
- **Decisão:** Postgres 17 em Docker (só o banco; a API segue com `pnpm dev`), Prisma 7 com driver adapter `pg` e uma tabela de log por rota.
- **Alternativas:** rodar a API também no Docker (descartado por ora).
- **Consequências:** é preciso subir o banco (`pnpm db:up`) antes da API. A CLI `prisma` está fixa em `7.10.1` (o tag `latest` já aponta para a 8 rc).

## 006 — Templates por nome e criação sequencial

- **Data:** 2026-11-16
- **Status:** aceita
- **Contexto:** as páginas criadas pela API precisam sair com o conteúdo dos templates dos databases. Os databases têm 76 templates (1 ano, 4 trimestres, 12 meses, 53 semanas, 7 dias), nomeados exatamente como as páginas geradas.
- **Decisão:** buscar os templates (`dataSources.listTemplates`) a cada chamada e casá-los **pelo nome**, validando tudo antes de criar (422 se faltar); o ano usa o template padrão. Criar as páginas **uma por vez**.
- **Alternativas:** IDs de template em variáveis de ambiente (descartado: ~76 IDs); cache em banco (descartado: desatualiza e é pouco chamado). Criar com 3 simultâneas (descartado: em teste, template + relação em paralelo mandou 3 de 28 dias para a lixeira, sem erro; sem template ou sequencial, 0 perdas — e a ordem dos filhos na relação do pai também embaralhava).
- **Consequências:** ~430 páginas levam ~6–7 min numa única requisição HTTP (sem timeout no servidor). Renomear um template no Notion passa a dar 422. A perda silenciosa de páginas foi contornada, não explicada pelo Notion; nada detecta se voltar. Validado à mão em nov–dez/2026 (57 páginas, 0 perdidas, ordem correta) e criando um ano pela API; o `repair` com template foi validado ao vivo pelo teste E2E (`test:e2e`, nov/2026: createYear out–dez → repair set–dez → deleteYear em 2090, 0 páginas perdidas). A detecção de página perdida agora existe só nesse teste, não em produção.

## 007 — Trava por ano no Postgres contra operações simultâneas

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** `createYear`/`repair`/`deleteYear` levam minutos e não havia proteção: duas chamadas do mesmo ano ao mesmo tempo podiam duplicar páginas ou apagar o ano durante a criação.
- **Decisão:** tabela `year_operation_lock` com `year` como chave primária; a operação insere a linha ao começar e remove ao terminar. Segunda tentativa → **409**. Trava presa é limpa ao subir a API e por TTL de 1 h.
- **Alternativas:** tabela de operações com `status` e índice único parcial (`WHERE status = 'running'`): descartada por exigir SQL manual fora do schema do Prisma e dar mais histórico do que se usa hoje (os logs de sucesso já existem). Lock em memória: não sobrevive a reinício e não vale com mais de uma instância.
- **Consequências:** a API passa a depender do Postgres também para executar (não só para logar). A trava é por ano e vale entre os 3 tipos de operação. Se um dia houver status consultável (rota 202 + polling), a tabela cresce para um registro de operações.

## 008 — Timeout de 60 s por chamada ao Notion, resposta 504

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** a requisição inteira dura minutos (decisão 006), então um timeout total não serve; o risco é uma única chamada ao Notion travar e deixar a requisição pendurada.
- **Decisão:** `timeoutMs: 60_000` no client do Notion (por chamada) e **504** nas rotas quando estourar, com mensagem dizendo que o Notion está demorando. O tempo estimado de cada rota fica na descrição do Swagger.
- **Alternativas:** timeout na requisição HTTP inteira (descartado: cortaria criações normais de 7 min); rota assíncrona com 202 + consulta de status (adiada: só compensa se o `web` passar a consumir a API).
- **Consequências:** uma chamada lenta mas válida (>60 s) vira erro; se isso acontecer na prática, aumentar `NOTION_TIMEOUT_MS`. A rota `GET /databases/:id/schema` ainda responde 500 em timeout.

## 009 — Rotas REST por recurso (`/years`)

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** `POST /createYear` e `DELETE /deleteYear` repetiam o verbo HTTP no caminho, e o reparo era uma flag (`repair: 1`) da rota de criar, que por isso respondia 200 **ou** 201 e misturava os erros das duas operações (404 só fazia sentido no reparo).
- **Decisão:** `POST /years` (body `{ year?, startToday? }`), `POST /years/:year/repair` (body `{ startToday? }`) e `DELETE /years/:year`. Uma pasta por recurso em `http/routes/<recurso>/`, schemas comuns em `http/schemas/common.ts` e tradução de erros em `http/errors.ts` (`toHttpError`, tipado contra os status que cada rota declara).
- **Alternativas:** `PUT /years/:year` para o reparo (descartado: reparo não substitui o recurso, é uma ação); manter `year` no body do reparo (descartado: o ano identifica o recurso, então vai no path); `year` obrigatório também no `POST /years` (descartado: o padrão "ano atual" é o uso mais comum).
- **Consequências:** quebra clientes das rotas antigas (só havia uso manual/Swagger). O reparo perdeu o padrão "ano atual": o ano vai sempre no path. `startToday` continua nas duas rotas. Os services e o E2E não mudaram (chamam os services direto).

## 010 — `*_TOKEN` de período renomeadas para `*_DATABASE_ID`

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** `YEAR_TOKEN`, `QUARTERLY_TOKEN`... eram IDs de database, não tokens; a confusão precisava de um aviso no CLAUDE.md.
- **Decisão:** `YEAR_DATABASE_ID`, `QUARTER_DATABASE_ID`, `MONTH_DATABASE_ID`, `WEEK_DATABASE_ID`, `DAY_DATABASE_ID`. `NOTION_TOKEN` segue sendo o único token.
- **Consequências:** cada `.env` precisa ser atualizado à mão (o `.env.example` já está). Lição: nome bom é documentação que a IA não erra.

## 011 — Vitest para testes unitários, portão lint + tipos + testes via Turbo

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** a API não tinha scripts `lint`/`check-types`: o `pnpm lint && pnpm check-types` exigido pelo CLAUDE.md passava sem verificar a API (o Turbo mostra `<NONEXISTENT>` e segue). A única rede de proteção era o E2E de ~5 min no Notion real.
- **Decisão:** scripts `lint` (ESLint 9 com a config base), `check-types` (`tsc --noEmit`) e `test` (Vitest) na API; `lint`/`check-types` no `packages/env`; tarefa `test` no `turbo.json`; variáveis em `globalEnv` do Turbo (exigido pelo `eslint-plugin-turbo` e correto para o cache). Testes ao lado do código (`*.test.ts`), começando pelo `routine-calendar`.
- **Alternativas:** Jest (descartado: precisa de configuração extra para TS/ESM; Vitest roda TS direto e tem API compatível); `node:test` (descartado: sem watch/mocks tão práticos).
- **Consequências:** `pnpm lint && pnpm check-types && pnpm test` cobre api, web e env. Para testar rotas, a montagem do Fastify saiu do `server.ts` para `http/app.ts` (`buildApp`). Os testes de rota acharam que `POST` sem body falhava com 400 (o Fastify entrega `null` e o Zod `.optional()` só aceita `undefined`); os bodies opcionais passaram a `.nullish()`. Os testes acharam que anos bissextos que começam no domingo (2040) têm **54 semanas** — exige o template `Semana 54`.

## 012 — Web: landing page com Next.js App Router, Tailwind 4 e shadcn/ui

- **Data:** 2026-11-19
- **Status:** aceita
- **Contexto:** `apps/web` ainda era o template do create-turbo (e `packages/ui` só existia para ele).
- **Decisão:** landing page em `app/(home)/` (route group com `_components/` por seção), Tailwind 4 via `@tailwindcss/postcss`, componentes shadcn em `components/ui`. `packages/ui` e `meta.json` removidos.
- **Alternativas:** manter `packages/ui` com os componentes shadcn (descartado por ora: só um app consome; volta a fazer sentido se surgir um segundo front).
- **Consequências:** dark mode do shadcn é por classe (`.dark`), sem alternador ainda.

## 013 — Workflows como skills, branch por demanda e squash merge

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** todo commit ia direto na `main` e o processo vivia espalhado no CLAUDE.md. Faltava um caminho repetível de "pedido → código revisado na main" que o Claude seguisse sozinho e que servisse para os próximos projetos.
- **Decisão:** skills de projeto `spec-authoring`, `feature`, `bugfix`, `revisar` e `pr` (esta só por `/pr`, pois publica no GitHub); artefatos de cada demanda em `docs/workflows/<slug>/` (spec, plano, review, handoff) com templates na `spec-authoring`; rules sempre carregadas em `.claude/rules/` (fluxo git e correções pendentes); `docs/pendencias.md` com IDs `PF-NNN`; branch `<tipo>/<slug>` com um commit por incremento e **squash merge** na `main`. O comando `/revisar` virou a skill `revisar` (não `review`, para não colidir com o `/review` embutido do Claude Code), que continua delegando ao subagente `revisor`.
- **Alternativas:** pasta `workflow/` só com markdown citada no CLAUDE.md (o Claude não escolhe sozinho qual usar); tudo no CLAUDE.md (incha o contexto de toda sessão); merge commit ou rebase (descartados: o squash mantém "um pedido = um commit" na `main` e deixa a branch livre para commits pequenos); artefatos em `specs/` na raiz (escolhido `docs/workflows/`, junto das outras docs).
- **Consequências:** a regra antiga "commit só no final, direto na main" foi substituída. Toda demanda ganha uma pasta de docs. Skills são instruções, não garantia: bloquear commit na `main` exige hook (`PF-008`). Reuso em outros projetos via plugin (`PF-007`).

## Pendentes

> Itens de backlog foram para [pendencias.md](./pendencias.md) (`PF-NNN`). Aqui ficam só decisões em aberto.

- [x] Padrão de nomes para rotas HTTP — REST, ver 009
- [x] Framework de testes — Vitest (011), com testes de rota (`app.inject`), helpers e builders. Falta: testes unitários dos services (create/repair/delete) com Notion mockado; detecção de página perdida e ordem dos filhos seguem só no E2E
- [ ] Traduzir o projeto (i18n) — ver `PF-011`
- [x] Como relacionar os níveis no Notion — tabela em arquitetura.md
- [x] Template `Semana 54` no Notion — criado pelo usuário em 2026-11-20
- [ ] CI no GitHub Actions — ver `PF-002`
- [x] Fluxo de branches/PRs e skills por tipo de trabalho — ver 013
- [ ] Logs com status e erro — ver `PF-003`
