# Convenções

> Padrões de código e nomes. Se o Claude errar algo repetidamente, a regra provavelmente falta aqui.

## Geral

- TypeScript em tudo. Evite `any`.
- Formatação: Prettier (`pnpm format`). Lint: ESLint 9 (`pnpm lint`).
- Pacotes internos: escopo `@notion-automation/*`, referenciados como `workspace:*`.
- Na API, use o alias `@/*` → `apps/api/src/*` para imports internos.

## Nomes

| O quê                 | Padrão                                        | Exemplo                              |
| --------------------- | --------------------------------------------- | ------------------------------------ |
| Arquivo de rota       | kebab-case                                    | `routes/new-year.ts`                 |
| Função plugin da rota | camelCase                                     | `export async function newYear(app)` |
| Caminho HTTP          | _a definir_ (hoje: `/createYear`)             | —                                    |
| Arquivo em `lib/`     | _a definir_ (hoje: camelCase `createYear.ts`) | —                                    |
| Variável de ambiente  | SCREAMING_SNAKE_CASE                          | `PORT_BACKEND`                       |

> 💡 Decida um padrão para caminhos HTTP (ex.: REST `POST /years`) e para arquivos de `lib/`, e registre em [decisoes.md](./decisoes.md).

## Rotas (Fastify)

- Cada rota é um **plugin** em `src/http/routes/` e é registrada em `src/http/server.ts`.
- Use `app.withTypeProvider<ZodTypeProvider>()` e declare `body`/`params`/`response` em `schema`.
- Sem regra de negócio na rota: delegue para `src/lib/`.
- Erros: responda com status coerente (4xx/5xx) e `success: false`. Nunca `200` em caso de erro.

## Variáveis de ambiente

- Nunca acesse `process.env` direto; importe `env` de `@notion-automation/env`.
- Variável nova → adicione em **`server`** e em **`runtimeEnv`** de `packages/env/index.ts`.
- Nunca leia, exiba ou commite o `.env`.

## Commits

- Conventional Commits em português: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Exemplo: `feat: cria trimestres ao gerar o ano`.
- **Commit só no final de todas as etapas.** Uma feature/funcionalidade pode ter várias etapas (lib, rota, docs...);
  não se commita a cada etapa. Fluxo: implementar todas as etapas → `pnpm lint && pnpm check-types` → revisar → **um** commit.
  Só depois de concluir o pedido por inteiro começa-se o próximo (que terá seu próprio commit).
- Se mudanças de pedidos/funcionalidades diferentes já estiverem misturadas, separe-as em commits distintos
  (stage parcial do arquivo), na ordem em que foram feitas, cada uma compilando sozinha.
- Correções descobertas durante uma implementação, mas que são globais (ex.: error handler), vão em commit próprio (`fix:`).
- Push só quando pedido.

## Testes

_Ainda não configurados._ Quando forem, registre aqui: framework, onde ficam os arquivos, como mockar o Notion.
