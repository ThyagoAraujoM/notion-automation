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
- **Alternativas:** Nenhuma.
- **Consequências:** Nenhuma.

## 002 — Fastify + Zod na API

- **Status:** aceita
- **Contexto:** API precisa de validação de rotas e schemas de request/response, tipados no TypeScript.
- **Decisão:** Fastify 5 com `fastify-type-provider-zod` para tipar e validar rotas.
- **Alternativas:** - Express (descartado: menos performático, menos tipado, menos plugins)
- **Consequências:** - validação de rotas e schemas de request/response com Zod, tipados no TypeScript

## 003 — Um database do Notion por nível

- **Status:** aceita
- **Contexto:** Ano, Trimestre, Mês, Semana e Dia têm propriedades diferentes.
- **Decisão:** cada nível tem seu próprio database; IDs nas variáveis `*_DATABASE_ID` (antes `*_TOKEN`; ver 010).
- **Alternativas:** Nenhuma.
- **Consequências:** Nenhuma.

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
- **Status:** aceita; a parte do squash merge foi substituída por 015
- **Contexto:** todo commit ia direto na `main` e o processo vivia espalhado no CLAUDE.md. Faltava um caminho repetível de "pedido → código revisado na main" que o Claude seguisse sozinho e que servisse para os próximos projetos.
- **Decisão:** skills de projeto `spec-authoring`, `feature`, `bugfix`, `revisar` e `pr` (esta só por `/pr`, pois publica no GitHub); artefatos de cada demanda em `docs/workflows/<slug>/` (spec, plano, review, handoff) com templates na `spec-authoring`; rules sempre carregadas em `.claude/rules/` (fluxo git e correções pendentes); `docs/pendencias.md` com IDs `PF-NNN`; branch `<tipo>/<slug>` com um commit por incremento e **squash merge** na `main`. O comando `/revisar` virou a skill `revisar` (não `review`, para não colidir com o `/review` embutido do Claude Code), que continua delegando ao subagente `revisor`.
- **Alternativas:** pasta `workflow/` só com markdown citada no CLAUDE.md (o Claude não escolhe sozinho qual usar); tudo no CLAUDE.md (incha o contexto de toda sessão); merge commit ou rebase (descartados: o squash mantém "um pedido = um commit" na `main` e deixa a branch livre para commits pequenos); artefatos em `specs/` na raiz (escolhido `docs/workflows/`, junto das outras docs).
- **Consequências:** a regra antiga "commit só no final, direto na main" foi substituída. Toda demanda ganha uma pasta de docs. Skills são instruções, não garantia: bloquear commit na `main` exige hook (`PF-008`). Reuso em outros projetos via plugin (`PF-007`).

## 014 — Log único de operações (`operation_log`) e `POSTGRES_HOST`

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** os logs só gravavam sucesso, em duas tabelas com uma coluna JSON (`log_create_year`, que também recebia o reparo, e `log_deleted_year`). Falhas (409, 422, 504, 500) não deixavam rastro e não dava para filtrar por ano, operação ou duração. O host do Postgres era `localhost` fixo (`PF-003`, `PF-004`).
- **Decisão:** tabela `operation_log` com colunas próprias (ano, operação e status como enums do Postgres, código HTTP, resposta, erro interno, início, fim, duração), gravada pelas rotas via `startOperationLog` em toda requisição que chega ao handler. As tabelas antigas foram copiadas e removidas na mesma migration. Variável `POSTGRES_HOST` com padrão `localhost`.
- **Alternativas:** gravar dentro do `withYearLock` (camada de service, não conhece o status HTTP); hook `onResponse` do Fastify (logaria todas as rotas e não tem o erro interno); `operation`/`status` como texto livre (enum dá validação no banco); manter as tabelas antigas (o objetivo era uma só).
- **Consequências:** é a base para o status de operações assíncronas (`PF-001`). A migration foi escrita à mão (o `prisma migrate dev` só apagaria as tabelas antigas); migrations com cópia de dados vão seguir esse padrão: `prisma migrate diff --from-config-datasource --to-schema ... --script`, editar e aplicar com `db:deploy`. A mensagem interna de erros 500 fica gravada no banco: não registrar segredos em mensagens de erro.

## 015 — Merge commit em vez de squash

- **Data:** 2026-11-20
- **Status:** aceita (substitui a parte de merge da 013)
- **Contexto:** a 013 escolheu squash merge ("um pedido = um commit na `main`"). Nos PRs #1 e #2 o merge saiu como merge commit, e o usuário preferiu assim: com os commits da branch visíveis na `main`, fica fácil achar em qual commit cada modificação foi feita (`git log`, `git blame`, `git bisect`).
- **Decisão:** PRs entram na `main` com **merge commit** (padrão do GitHub). Cada commit da branch precisa se sustentar sozinho (portão verde, mensagem clara, sem "wip"/"fixup"); correção de revisão vira commit próprio. Pós-merge: `git branch -d`.
- **Alternativas:** squash (descartado: perde a granularidade que o usuário quer rastrear); rebase merge (mantém os commits, mas sem o commit de merge que agrupa a demanda e aponta o PR).
- **Consequências:** histórico da `main` maior; `git log --first-parent --oneline main` dá a visão de uma linha por demanda. Para desfazer uma demanda inteira: `git revert -m 1 <merge>`. Para forçar no GitHub, deixar só "Allow merge commits" nas configurações do repositório.

## 016 — Fim de linha LF fixado no `.gitattributes`

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** no Windows o Git usa `core.autocrlf=true` (escreve `CRLF` no disco) e o Prettier grava `LF`. A cada formatação dezenas de arquivos apareciam como modificados sem mudança de conteúdo, e todo commit avisava "LF will be replaced by CRLF" (`PF-015`).
- **Decisão:** `.gitattributes` com `* text=auto eol=lf` e binários marcados como `binary`. O repositório já estava todo em `LF`; só os arquivos do disco foram convertidos e o índice renormalizado.
- **Alternativas:** `core.autocrlf false` só na máquina do usuário (não acompanha o repositório); `endOfLine: "crlf"` no Prettier (deixaria o repositório dependente do Windows e quebraria scripts shell).
- **Consequências:** `git status` só mostra mudança real. O `eol=lf` do `.gitattributes` tem precedência sobre o `core.autocrlf` de cada máquina, então vale para qualquer um que clonar. Clones que já existiam podem continuar com `CRLF` no disco até renormalizar (ver `docs/convencoes.md`, Geral). **Para novos projetos:** criar o `.gitattributes` no primeiro commit.

## 017 — Operações longas em segundo plano (202 + job no Postgres + polling)

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** `POST /years` levava 6–7 min numa única requisição, e `DELETE /years/:year` (3–4 min) e o `repair` (1 min ou mais) tinham o mesmo problema. Proxies, navegadores e clientes HTTP cortam conexões longas, e quem chamava ficava preso esperando (`PF-001`).
- **Decisão:** as três rotas validam o que é síncrono (Zod, `startToday`, trava do ano), gravam um job em `year_job` (`running`), disparam o service **sem `await`** no próprio processo e respondem **202** com `jobId` e `Location: /years/jobs/:jobId`. Quando o service termina, o job recebe o código e o corpo que a rota síncrona daria (`succeeded`/`failed`), a linha do `operation_log` é gravada e a trava é solta. O cliente faz polling em `GET /years/jobs/:jobId`. Ao subir, a API marca como `failed` os jobs que ficaram `running`.
- **Alternativas:** pg-boss ou graphile-worker (sugestão da `PF-001`; fila com retentativa, vários workers e agendamento, nada disso necessário com uma instância só. O `createYear` já faz rollback e repair/delete são idempotentes, e retentar automaticamente poderia duplicar páginas: seria uma dependência a mais sem ganho); reaproveitar `operation_log` como tabela de job (é histórico de operações concluídas, e misturar o "em andamento" exigiria colunas nulas e updates); job só em memória (o status se perde ao reiniciar); SSE/WebSocket (mantêm a conexão longa aberta, que é o que se quer evitar).
- **Consequências:** contrato das três rotas mudou de 200/201 para 202. Erros que dependem do Notion (ano já existe, ano não existe, templates, timeout) aparecem no status do job, não na resposta do POST/DELETE. Se o processo cair no meio, a operação para sem rollback (o job vira `failed` e a mensagem indica `repair`). **Vale enquanto houver uma instância da API:** com várias, seria preciso um worker separado e uma fila de verdade (aí sim pg-boss). A tabela `year_job` cresce sem limpeza automática.

## 018 — CI no GitHub Actions (um job, mesmo portão do local)

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** o portão (`lint`, `check-types`, `test`) dependia de alguém lembrar de rodar, e o fluxo já usa PR com merge commit (`PF-002`).
- **Decisão:** um workflow com um job que instala com `--frozen-lockfile` e roda `lint`, `check-types`, `test` e `build`, em `pull_request` e `push` na `main`, com `permissions: contents: read`. Node 22 (o Prisma 7 exige >= 20.19). Sem secrets, sem Postgres, sem E2E.
- **Alternativas:** um job por etapa (reinstala as dependências em cada um, sem ganho num repositório pequeno); rodar o E2E (~5 min e escreve no Notion real); `services: postgres` (os testes atuais não usam banco, ver `PF-006`); só hook local (não pega o que escapa da máquina nem protege o PR).
- **Consequências:** todo PR mostra o check verde ou vermelho. Para bloquear o merge é preciso ativar a branch protection exigindo o check (configuração do GitHub, fora do repositório). O teste de integração do `PF-006` (`test:integration`) ficou fora do CI; para rodá-lo lá, o job ganha um `services:` com Postgres e `db:deploy`. **Para novos projetos:** criar o workflow junto com o primeiro teste, e alinhar o Node do CI com o `engines`.

## 019 — Build da API com tsup, um bundle único

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** a API só rodava via `tsx` (`PF-005`). O `@notion-automation/env` é TypeScript do workspace (`main: index.ts`), então `tsc` sozinho gera um `dist` que o Node não consegue executar.
- **Decisão:** `tsup` empacota `src/http/server.ts` em `dist/server.js` (CJS, target node20), com o `@notion-automation/env` dentro do bundle e as demais dependências externas. `build` gera o bundle, `start` roda `node dist/server.js` com as variáveis do ambiente, `start:local` carrega o `.env` da raiz. `engines.node` é `>=20.19`.
- **Alternativas:** `tsc` com `references` e build do pacote `env` (mais configuração e `dist` do env para publicar); rodar `tsx` em produção (compila em cada start e é dependência de dev); bundlar também o `node_modules` (o Prisma e o `pg` ficam piores de empacotar).
- **Consequências:** o deploy precisa de `node_modules` de produção (o `prisma generate` do `postinstall` gera o client, que entra no bundle). Não há Dockerfile ainda. **Para novos projetos:** definir o `build` junto com o `engines` e conferir que o `start` não depende de devDependencies.

## 020 — Guard-rails automáticos: hook PreToolUse e verificação do env

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** regras como "nunca commitar na `main`", "nunca ler o `.env`" e "`process.env` só pelo pacote `env`" dependiam de a IA lembrar (`PF-008`, `PF-009`). O `deny` do `settings.json` cobre só as ferramentas Read/Edit, não o shell.
- **Decisão:** (1) hook `PreToolUse` `.claude/hooks/guard.mjs` (Bash e PowerShell) bloqueia `git commit` na `main` e comandos que citam `.env`/`.env.*` (exceto `.env.example`); lógica em função pura, testada com `node --test` dentro do `pnpm test`. (2) Regra ESLint `no-restricted-properties` proíbe `process.env`, com `off` explícito nas três exceções. (3) Teste `env-consistency` compara `server`, `runtimeEnv`, `globalEnv` e `.env.example` lendo os arquivos como texto.
- **Alternativas:** hooks do Git (`pre-commit`) só valem localmente e podem ser pulados, e não pegam a leitura do `.env`; checar tudo só no CI avisa tarde; importar o `env` no teste valida o ambiente em vez de comparar listas.
- **Consequências:** o hook é regex (rede de segurança, não sandbox: não pega ofuscação) e também barra comandos que só mencionam `.env` no texto; para commit use mensagem sem o nome do arquivo. A branch é lida antes de o comando rodar: se o mesmo comando troca de branch (`git switch`/`checkout` antes do `commit`) o hook não decide pela branch atual, e `cd outro && git commit` avalia a branch do diretório original. Mudança em `settings.json` pode exigir reiniciar a sessão. **Para novos projetos:** nascer com o hook, a regra de lint e o teste de consistência do env.

## 021 — Idioma: código em inglês, textos em português por ora

- **Data:** 2026-11-20
- **Status:** aceita
- **Contexto:** a API misturava rótulos em inglês nas mensagens em português (`PF-011`). A API é pensada como internacional, com documentação multilíngue no futuro; hoje só há português.
- **Decisão:** identificadores e chaves de JSON em inglês; comentários, descrições do Swagger e mensagens da API em português. Mensagens não mostram identificadores crus: o rótulo é traduzido na mensagem (nível do template, operação da trava, contexto da validação) e o Zod usa o locale `pt`.
- **Alternativas:** i18n completo agora (catálogo, negociação via `Accept-Language`) é custo sem segundo idioma; tudo em inglês perde o público atual.
- **Consequências:** a tradução fica espalhada em poucos mapas (`TEMPLATE_LEVEL_LABEL`, `OPERATION_LABEL`, `VALIDATION_CONTEXT_LABEL`). Quando surgir o segundo idioma, vira catálogo de mensagens. Textos que vêm do Notion/Fastify ficam no idioma de origem.

## Pendentes

> Itens de backlog foram para [pendencias.md](./pendencias.md) (`PF-NNN`). Aqui ficam só decisões em aberto.

- [x] Padrão de nomes para rotas HTTP — REST, ver 009
- [x] Framework de testes — Vitest (011), com testes de rota (`app.inject`), helpers e builders. Falta: testes unitários dos services (create/repair/delete) com Notion mockado; detecção de página perdida e ordem dos filhos seguem só no E2E
- [x] Idioma do código e das mensagens — ver 021 (i18n real só quando houver um segundo idioma)
- [x] Como relacionar os níveis no Notion — tabela em arquitetura.md
- [x] Template `Semana 54` no Notion — criado pelo usuário em 2026-11-20
- [x] CI no GitHub Actions — ver 018
- [x] Fluxo de branches/PRs e skills por tipo de trabalho — ver 013
- [x] Logs com status e erro — ver 014
