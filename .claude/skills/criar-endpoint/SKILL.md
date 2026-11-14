---
name: criar-endpoint
description: Passo a passo para criar uma nova rota HTTP na API Fastify do notion-automation (plugin em routes/, lógica em lib/, schema Zod, registro no server.ts). Use quando o usuário pedir para criar/adicionar um endpoint, rota ou chamada nova da API.
---

# Criar endpoint na API

Siga os passos em ordem. Convenções completas em `docs/convencoes.md`.

## 1. Entender o pedido
- Método e caminho HTTP? Corpo/params de entrada? Formato da resposta?
- Qual nível do Notion é afetado (Ano/Trimestre/Mês/Semana/Dia) e qual variável `*_TOKEN`?
- Se faltar algo essencial, pergunte antes de criar arquivos.

## 2. Lógica em `apps/api/src/lib/`
Crie a função de caso de uso. Ela **não conhece Fastify**: recebe dados tipados, devolve dados.

```ts
import { env } from "@notion-automation/env";
import { notion } from "./notion";

export async function criarAlgo(input: { nome: string }) {
  return notion.pages.create({
    parent: { database_id: env.YEAR_TOKEN },
    properties: { Name: { title: [{ text: { content: input.nome } }] } },
  });
}
```

## 3. Rota em `apps/api/src/http/routes/<nome-kebab>.ts`
```ts
import { criarAlgo } from "@/lib/criarAlgo";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

export async function nomeDaRota(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/caminho",
    {
      schema: {
        tags: ["Rotine"],
        summary: "O que a rota faz",
        body: z.object({ nome: z.string() }),
        response: {
          201: z.object({ success: z.literal(true), message: z.string() }),
          500: z.object({ success: z.literal(false), message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await criarAlgo(request.body);
        return reply.status(201).send({ success: true, message: "Criado" });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ success: false, message: "Erro ao criar" });
      }
    },
  );
}
```

## 4. Registrar em `apps/api/src/http/server.ts`
```ts
import { nomeDaRota } from "./routes/nome-da-rota";
app.register(nomeDaRota);
```

## 5. Variável de ambiente nova?
Adicione em `server` **e** `runtimeEnv` de `packages/env/index.ts`. Avise o usuário para incluir no `.env` (nunca edite o `.env` você mesmo).

## 6. Verificar
- `pnpm check-types` e `pnpm lint` na raiz.
- Se a API estiver rodando, teste: `curl -X POST http://localhost:4000/caminho -H "Content-Type: application/json" -d '{"nome":"teste"}'`
- Atualize a tabela "Rotas existentes" em `docs/arquitetura.md`.

## Checklist final
- [ ] Lógica em `lib/`, rota só com HTTP
- [ ] Schema Zod de entrada e de resposta
- [ ] Erro devolve 4xx/5xx com `success: false`
- [ ] Rota registrada no `server.ts`
- [ ] Tipos e lint passando
- [ ] `docs/arquitetura.md` atualizado
