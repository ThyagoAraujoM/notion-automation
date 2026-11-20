import { APIErrorCode, APIResponseError } from "@notionhq/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { buildApp } from "@/http/app";
import { getDatabaseSchema } from "@/services/get-database-schema";

// O buildApp registra também as rotas de /years: mocka log e trava para o Prisma nunca
// ser tocado (regra de docs/convencoes.md#testes).
vi.mock("@/db/operation-log", () => ({ saveOperationLog: vi.fn() }));
vi.mock("@/services/shared/year-lock", () => ({ withYearLock: vi.fn() }));

vi.mock("@/services/get-database-schema", () => ({
  getDatabaseSchema: vi.fn(),
}));

const DB_ID = "0123456789abcdef0123456789abcdef";

/** Erro como o client do Notion lança quando a API responde com erro. */
const notionError = (code: APIErrorCode, status: number) =>
  new APIResponseError({
    code,
    status,
    message: "erro do Notion",
    headers: new Headers(),
    rawBodyText: "",
    additional_data: undefined,
    request_id: undefined,
  });

const app = buildApp({ logger: false });

beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(() => vi.clearAllMocks());

describe("GET /databases/:databaseId/schema", () => {
  const get = (id: string) =>
    app.inject({ method: "GET", url: `/databases/${id}/schema` });

  it("devolve as data sources e propriedades (200)", async () => {
    vi.mocked(getDatabaseSchema).mockResolvedValue({
      databaseId: DB_ID,
      dataSources: [
        {
          id: "ds-1",
          name: "Semanas",
          properties: [
            { id: "p1", name: "Name", type: "title" },
            {
              id: "p2",
              name: "Meses",
              type: "relation",
              relation: {
                databaseId: "db-meses",
                dataSourceId: "ds-meses",
                type: "dual_property",
                syncedPropertyName: "Semanas",
              },
            },
          ],
        },
      ],
    });

    const res = await get(DB_ID);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      success: true,
      databaseId: DB_ID,
      dataSources: [{ name: "Semanas" }],
    });
    expect(getDatabaseSchema).toHaveBeenCalledWith(DB_ID);
  });

  it("aceita o id com hífens", async () => {
    vi.mocked(getDatabaseSchema).mockResolvedValue({
      databaseId: DB_ID,
      dataSources: [],
    });

    const res = await get("01234567-89ab-cdef-0123-456789abcdef");

    expect(res.statusCode).toBe(200);
  });

  it("rejeita id que não é hexadecimal de 32 caracteres (400)", async () => {
    const res = await get("nao-e-um-id");

    expect(res.statusCode).toBe(400);
    expect(getDatabaseSchema).not.toHaveBeenCalled();
  });

  it("database inexistente ou sem acesso vira 404", async () => {
    vi.mocked(getDatabaseSchema).mockRejectedValue(
      notionError(APIErrorCode.ObjectNotFound, 404),
    );

    const res = await get(DB_ID);

    expect(res.statusCode).toBe(404);
    expect(res.json().success).toBe(false);
  });

  it("id recusado pelo Notion vira 400", async () => {
    vi.mocked(getDatabaseSchema).mockRejectedValue(
      notionError(APIErrorCode.ValidationError, 400),
    );

    const res = await get(DB_ID);

    expect(res.statusCode).toBe(400);
  });

  it("erro inesperado vira 500", async () => {
    vi.mocked(getDatabaseSchema).mockRejectedValue(new Error("boom"));

    const res = await get(DB_ID);

    expect(res.statusCode).toBe(500);
  });
});
