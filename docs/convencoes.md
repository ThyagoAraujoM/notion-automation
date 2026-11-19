# Convenções

> Padrões de código e nomes. Se o Claude errar algo repetidamente, a regra provavelmente falta aqui.

## Geral

- TypeScript em tudo. Evite `any`.
- Formatação: Prettier (`pnpm format`). Lint: ESLint 9 (`pnpm lint`).
- Pacotes internos: escopo `@notion-automation/*`, referenciados como `workspace:*`.
- Na API, use o alias `@/*` → `apps/api/src/*` para imports internos.

## Nomes

| O quê                                                    | Padrão                            | Exemplo                              |
| -------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| Arquivo de rota                                          | kebab-case                        | `routes/new-year.ts`                 |
| Função plugin da rota                                    | camelCase                         | `export async function newYear(app)` |
| Caminho HTTP                                             | _a definir_ (hoje: `/createYear`) | —                                    |
| Arquivo em `services/`, `utils/`, `db/`, `integrations/` | kebab-case                        | `services/create-year.ts`            |
| Variável de ambiente                                     | SCREAMING_SNAKE_CASE              | `PORT_BACKEND`                       |

> 💡 Decida um padrão para caminhos HTTP (ex.: REST `POST /years`) e registre em [decisoes.md](./decisoes.md).

## Rotas (Fastify)

- Cada rota é um **plugin** em `src/http/routes/` e é registrada em `src/http/server.ts`.
- Use `app.withTypeProvider<ZodTypeProvider>()` e declare `body`/`params`/`response` em `schema`.
- Sem regra de negócio na rota: delegue para `src/services/`.
- **Descrição das rotas no Swagger:** `description` é uma lista em markdown, um item por linha (`[...].join("\n")`), nunca um texto corrido. Padrão:
  - Seção `**Parâmetros**` com um item por parâmetro: ``- **`parametro`**: descrição do parâmetro.``
  - Seção `**Respostas**` com um item por status: ``- **`409`**: quando acontece.``
  - Avisos importantes em linha própria (`**Atenção**: ...`).
  - Além disso, descreva cada campo do `body`/`params`/`query` com `.describe("...")` no Zod.
  - Exemplo: `routes/new-year.ts`.
- Erros: responda com status coerente (4xx/5xx) e `success: false`. Nunca `200` em caso de erro.

## Variáveis de ambiente

- Nunca acesse `process.env` direto; importe `env` de `@notion-automation/env`.
- Variável nova → adicione em **`server`** e em **`runtimeEnv`** de `packages/env/index.ts`.
- Nunca leia, exiba ou commite o `.env`.

## Commits

- Conventional Commits em português: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Exemplo: `feat: cria trimestres ao gerar o ano`.
- **Commit só no final de todas as etapas.** Uma feature/funcionalidade pode ter várias etapas (service, rota, docs...);
  não se commita a cada etapa. Fluxo: implementar todas as etapas → `pnpm lint && pnpm check-types` → revisar → **um** commit.
  Só depois de concluir o pedido por inteiro começa-se o próximo (que terá seu próprio commit).
- Se mudanças de pedidos/funcionalidades diferentes já estiverem misturadas, separe-as em commits distintos
  (stage parcial do arquivo), na ordem em que foram feitas, cada uma compilando sozinha.
- Correções descobertas durante uma implementação, mas que são globais (ex.: error handler), vão em commit próprio (`fix:`).
- Push só quando pedido.

## Testes

### E2E no Notion real

`pnpm --filter=@notion-automation/api test:e2e [-- --year=2090] [--keep]` (código em `apps/api/src/scripts/e2e-routine.ts`).

- Roda `createYear` (out–dez) → `repair` (set–dez, precisa criar Setembro e o T3) → `deleteYear` num ano avulso (padrão **2090**) e confere o Notion lendo-o de volta (nomes, números, pais, contagens). Cada etapa imprime trimestre → mês → semanas → dias.
- Chama os **services** direto: não precisa da API no ar nem do Postgres. O recorte "a partir de uma data" usa a opção interna `from` dos services (`PlanFrom`), que a rota não expõe.
- Escreve no workspace **real** (e apaga no fim). Por segurança só aceita anos `>= ano atual + 10`, aborta se o ano já existir e só apaga o que ele criou. `--keep` deixa o ano no Notion para depuração.
- Sai com código 1 se algo falhar. Rode depois de mexer em `services/`, `integrations/notion/` ou `utils/routine-calendar.ts`.

Testes unitários (Vitest) ainda não configurados; quando forem, registre aqui: framework, onde ficam os arquivos, como mockar o Notion.
