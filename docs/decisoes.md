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
- **Decisão:** cada nível tem seu próprio database; IDs nas variáveis `*_TOKEN`.
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

## Pendentes

- [ ] Padrão de nomes para rotas HTTP
- [ ] Framework de testes (Vitest?) — incluir criar/reparar ano com template, ordem dos filhos e detecção de página perdida (hoje a validação foi manual)
- [ ] Traduzir o projeto (i18n): mensagens de erro/respostas da API hoje misturam português e rótulos em inglês (ex.: 422 de templates usa `quarter:`, `week:`...)
- [ ] Como relacionar os níveis no Notion
