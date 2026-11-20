---
name: criar-endpoint
description: Passo a passo para criar uma nova rota HTTP na API Fastify do notion-automation (rota REST em routes/<recurso>/, lógica em services/, schema Zod, erros via toHttpError, registro no buildApp, teste com app.inject). Use quando o usuário pedir para criar/adicionar um endpoint, rota ou chamada nova da API.
---

# Criar endpoint na API

Siga os passos em ordem. Convenções completas em `docs/convencoes.md` (seção "Rotas (Fastify)").

## 1. Entender o pedido

- Qual **recurso** (plural: `years`, `databases`...) e qual ação? CRUD usa o verbo HTTP (`POST /years`, `DELETE /years/:year`); ação que não é CRUD vira sub-recurso (`POST /years/:year/repair`). Nunca repita o verbo no caminho (`/createYear`).
- Identificador vai no **path**; opções vão no **body** (POST) ou **query** (GET).
- Qual nível do Notion é afetado (Ano/Trimestre/Mês/Semana/Dia) e qual variável `*_DATABASE_ID`?
- A operação pode levar mais que alguns segundos (muitas páginas no Notion)? Então ela **responde 202 e roda em segundo plano** com `startYearJob` (`@/http/year-job`), como as rotas de `/years` (`routes/years/create-year.ts` é o exemplo; ver `docs/arquitetura.md`, Operações em segundo plano). Validações puras e a trava continuam síncronas; o resultado sai em `GET /years/jobs/:jobId`.
- Se faltar algo essencial, pergunte antes de criar arquivos.

## 2. Lógica em `apps/api/src/services/`

Crie a função de caso de uso. Ela **não conhece Fastify**: recebe dados tipados, devolve dados e lança erros de domínio (`services/shared/errors.ts`).

```ts
import { env } from "@notion-automation/env";
import { notion } from "@/integrations/notion/client";

export async function criarAlgo(input: { nome: string }) {
  return notion.pages.create({
    parent: { database_id: env.YEAR_DATABASE_ID },
    properties: { Name: { title: [{ text: { content: input.nome } }] } },
  });
}
```

Lógica pura (sem I/O) vai em `utils/` **com teste** ao lado (`utils/<nome>.test.ts`, Vitest).

## 3. Rota em `apps/api/src/http/routes/<recurso>/<verbo>-<recurso>.ts`

Reaproveite `@/http/schemas/common` (`errorResponse`, `yearParams`, `flagSchema`, `levelCounts`) e traduza erros com `toHttpError` (`@/http/errors`), passando **só os status que a rota declara** em `response` (o TypeScript reclama se não bater).

```ts
import { NOTION_SLOW, toHttpError } from "@/http/errors";
import { errorResponse, yearParams } from "@/http/schemas/common";
import { fazerAlgo } from "@/services/fazer-algo";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function fazerAlgoRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/years/:year/algo",
    {
      schema: {
        tags: ["Rotina"],
        summary: "O que a rota faz",
        description: [
          "**Parâmetros**:",
          "",
          "- **`year`** (path): obrigatório. ...",
          "",
          "**Respostas**:",
          "",
          "- **`200`**: ...",
          "- **`404`**: ...",
        ].join("\n"),
        params: yearParams,
        body: z.object({ nome: z.string().describe("...") }),
        response: {
          200: z.object({ success: z.literal(true), message: z.string() }),
          400: errorResponse,
          404: errorResponse,
          500: errorResponse,
          504: errorResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        await fazerAlgo(request.params.year, request.body);
        return reply.status(200).send({ success: true, message: "Feito" });
      } catch (error) {
        const known = toHttpError(
          error,
          [404, 504],
          `${NOTION_SLOW} Tente novamente.`,
        );
        if (known) {
          return reply
            .status(known.status)
            .send({ success: false, message: known.message });
        }
        request.log.error(error);
        return reply
          .status(500)
          .send({ success: false, message: "Erro ao ..." });
      }
    },
  );
}
```

Erro de domínio novo? Crie a classe em `services/shared/errors.ts` e mapeie o status em `classify` de `http/errors.ts`.

## 4. Registrar

- Recurso existente: adicione em `routes/<recurso>/index.ts` (`await app.register(fazerAlgoRoute)`).
- Recurso novo: crie `routes/<recurso>/index.ts` e registre-o em `buildApp` (`apps/api/src/http/app.ts`). Tag nova do Swagger vai em `openapi.tags` do `app.ts`.

## 5. Teste da rota

Crie `routes/<recurso>/<recurso>.test.ts` (ou adicione ao existente) com `buildApp({ logger: false })` + `app.inject()`, mockando o service, o log e a trava. Cubra: sucesso, validação (400) e cada erro de domínio que a rota declara. Modelo: `routes/years/years.test.ts`; detalhes em `docs/convencoes.md#testes`.

Body opcional em POST: use `.nullish()`, não `.optional()` (sem body o Fastify entrega `null`).

## 6. Variável de ambiente nova?

Adicione em `server` **e** `runtimeEnv` de `packages/env/index.ts` **e** em `globalEnv` do `turbo.json`. Avise o usuário para incluir no `.env` e no `.env.example` (nunca edite o `.env` você mesmo).

## 7. Verificar

- Na raiz: `pnpm lint && pnpm check-types && pnpm test`.
- Se a API estiver rodando, teste: `curl -X POST http://localhost:4000/years/2026/algo -H "Content-Type: application/json" -d '{"nome":"teste"}'`
- Atualize a tabela "Rotas existentes" em `docs/arquitetura.md` (e esta skill, se o padrão mudou).

## Checklist final

- [ ] Caminho REST (recurso no plural, id no path, sem verbo no caminho)
- [ ] Lógica em `services/`, rota só com HTTP
- [ ] Schema Zod de entrada e de resposta, com `.describe()` e descrição em lista no Swagger
- [ ] Erros via `toHttpError` com 4xx/5xx e `success: false`
- [ ] Rota registrada no `index.ts` do recurso
- [ ] Teste da rota com `app.inject()`
- [ ] Lint, tipos e testes passando
- [ ] `docs/arquitetura.md` atualizado
