import { RequestTimeoutError } from "@notionhq/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { saveOperationLog } from "@/db/operation-log";
import { buildApp } from "@/http/app";
import { MissingTemplatesError } from "@/integrations/notion/helpers";
import { createYear } from "@/services/create-year";
import { deleteYear } from "@/services/delete-year";
import { repairYear } from "@/services/repair-year";
import {
  OperationInProgressError,
  YearAlreadyExistsError,
  YearNotFoundError,
} from "@/services/shared/errors";
import { withYearLock } from "@/services/shared/year-lock";
import { InvalidStartTodayError } from "@/utils/routine-calendar";

// Nada de Notion nem Postgres: services, trava e log são substituídos por mocks.
vi.mock("@/services/create-year", () => ({ createYear: vi.fn() }));
vi.mock("@/services/repair-year", () => ({ repairYear: vi.fn() }));
vi.mock("@/services/delete-year", () => ({ deleteYear: vi.fn() }));
vi.mock("@/db/operation-log", () => ({ saveOperationLog: vi.fn() }));
vi.mock("@/services/shared/year-lock", () => ({ withYearLock: vi.fn() }));

const counts = { quarters: 4, months: 12, weeks: 53, days: 365 };
const currentYear = new Date().getFullYear();

const app = buildApp({ logger: false });

beforeAll(() => app.ready());
afterAll(() => app.close());

beforeEach(() => {
  vi.clearAllMocks();
  // Por padrão a trava é obtida e só executa a operação
  vi.mocked(withYearLock).mockImplementation((_year, _op, fn) => fn());
  vi.mocked(saveOperationLog).mockResolvedValue({} as never);
});

describe("POST /years", () => {
  const post = (payload?: object) =>
    app.inject({ method: "POST", url: "/years", payload });

  it("cria o ano informado (201), com trava e log", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: 2027,
      yearPageId: "page-1",
      created: { years: 1, ...counts },
    });

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      success: true,
      year: 2027,
      yearPageId: "page-1",
      created: { years: 1, days: 365 },
    });
    expect(withYearLock).toHaveBeenCalledWith(
      2027,
      "createYear",
      expect.any(Function),
    );
    expect(createYear).toHaveBeenCalledWith(2027, false);
    expect(saveOperationLog).toHaveBeenCalledOnce();
  });

  it("sem body usa o ano atual e o ano inteiro", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: currentYear,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });

    const res = await app.inject({ method: "POST", url: "/years" });

    expect(res.statusCode).toBe(201);
    expect(createYear).toHaveBeenCalledWith(currentYear, false);
  });

  it("repassa startToday: 1 como true", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: currentYear,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });

    const res = await post({ startToday: 1 });

    expect(res.statusCode).toBe(201);
    expect(res.json().message).toContain("a partir de hoje");
    expect(createYear).toHaveBeenCalledWith(currentYear, true);
  });

  it("ignora o antigo parâmetro repair (o Zod descarta a chave e cria)", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: 2027,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });

    const res = await post({ year: 2027, repair: 1 });

    expect(res.statusCode).toBe(201);
    expect(repairYear).not.toHaveBeenCalled();
    expect(createYear).toHaveBeenCalledOnce();
  });

  it.each([
    [{ year: 1969 }],
    [{ year: 2101 }],
    [{ year: 2026.5 }],
    [{ startToday: 2 }],
  ])("valida o body (400) para %j", async (payload) => {
    const res = await post(payload);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false });
    expect(createYear).not.toHaveBeenCalled();
  });

  it.each([
    ["startToday fora do ano atual", new InvalidStartTodayError(2027), 400],
    ["ano já existe", new YearAlreadyExistsError(2027), 409],
    [
      "operação em andamento",
      new OperationInProgressError(2027, "deleteYear"),
      409,
    ],
    [
      "templates faltando",
      new MissingTemplatesError({
        quarter: [],
        month: [],
        week: ["Semana 54"],
        day: [],
      }),
      422,
    ],
  ])("traduz %s para o status certo", async (_name, error, status) => {
    vi.mocked(createYear).mockRejectedValue(error);

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ success: false, message: error.message });
    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", statusCode: status }),
    );
  });

  it("responde 504 com rollback na mensagem quando o Notion estoura o tempo", async () => {
    vi.mocked(createYear).mockRejectedValue(new RequestTimeoutError());

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(504);
    expect(res.json().message).toContain("lixeira");
    expect(res.json().message).toContain("POST /years/2027/repair");
  });

  it("erro que não pertence à rota (404) vira 500", async () => {
    vi.mocked(createYear).mockRejectedValue(new YearNotFoundError(2027));

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      success: false,
      message: "Erro ao criar a rotina anual.",
    });
  });

  it("falha ao gravar o log não muda a resposta", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: 2027,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });
    vi.mocked(saveOperationLog).mockRejectedValue(new Error("db fora"));

    const res = await post({ year: 2027 });

    expect(saveOperationLog).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(201);
  });

  it("JSON inválido vira 400 do próprio Fastify, no formato padrão", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/years",
      headers: { "content-type": "application/json" },
      payload: "{ year: ",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
    expect(createYear).not.toHaveBeenCalled();
  });

  it("erro inesperado vira 500 sem vazar a mensagem interna", async () => {
    vi.mocked(createYear).mockRejectedValue(new Error("segredo interno"));

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("segredo interno");
  });
});

describe("POST /years/:year/repair", () => {
  const repair = (year: string | number, payload?: object) =>
    app.inject({ method: "POST", url: `/years/${year}/repair`, payload });

  it("repara o ano do path (200)", async () => {
    vi.mocked(repairYear).mockResolvedValue({
      year: 2026,
      yearPageId: "p",
      created: { quarters: 0, months: 1, weeks: 2, days: 3 },
      relinked: { months: 0, weeks: 1, days: 0 },
    });

    const res = await repair(2026);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      success: true,
      year: 2026,
      created: { days: 3 },
      relinked: { weeks: 1 },
    });
    expect(withYearLock).toHaveBeenCalledWith(
      2026,
      "repairYear",
      expect.any(Function),
    );
    expect(repairYear).toHaveBeenCalledWith(2026, false);
    expect(saveOperationLog).toHaveBeenCalledOnce();
  });

  it("repassa startToday: 1", async () => {
    vi.mocked(repairYear).mockResolvedValue({
      year: currentYear,
      yearPageId: "p",
      created: { quarters: 0, months: 0, weeks: 0, days: 0 },
      relinked: { months: 0, weeks: 0, days: 0 },
    });

    await repair(currentYear, { startToday: 1 });

    expect(repairYear).toHaveBeenCalledWith(currentYear, true);
  });

  it("valida o ano do path (400)", async () => {
    const res = await repair("abc");

    expect(res.statusCode).toBe(400);
    expect(repairYear).not.toHaveBeenCalled();
  });

  it.each([
    ["ano inexistente", new YearNotFoundError(2026), 404],
    [
      "operação em andamento",
      new OperationInProgressError(2026, "createYear"),
      409,
    ],
    ["startToday fora do ano atual", new InvalidStartTodayError(2026), 400],
    [
      "templates faltando",
      new MissingTemplatesError({
        quarter: ["T1"],
        month: [],
        week: [],
        day: [],
      }),
      422,
    ],
  ])("traduz %s para o status certo", async (_name, error, status) => {
    vi.mocked(repairYear).mockRejectedValue(error);

    const res = await repair(2026);

    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ success: false, message: error.message });
  });

  it("responde 504 sugerindo repetir quando o Notion estoura o tempo", async () => {
    vi.mocked(repairYear).mockRejectedValue(new RequestTimeoutError());

    const res = await repair(2026);

    expect(res.statusCode).toBe(504);
    expect(res.json().message).toContain("Tente novamente");
  });

  it("erro inesperado vira 500 sem vazar a mensagem interna", async () => {
    vi.mocked(repairYear).mockRejectedValue(new Error("segredo interno"));

    const res = await repair(2026);

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      success: false,
      message: "Erro ao reparar a rotina anual.",
    });
  });

  it("falha ao gravar o log não muda a resposta", async () => {
    vi.mocked(repairYear).mockResolvedValue({
      year: 2026,
      yearPageId: "p",
      created: { quarters: 0, months: 0, weeks: 0, days: 0 },
      relinked: { months: 0, weeks: 0, days: 0 },
    });
    vi.mocked(saveOperationLog).mockRejectedValue(new Error("db fora"));

    const res = await repair(2026);

    expect(saveOperationLog).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /years/:year", () => {
  const del = (year: string | number) =>
    app.inject({ method: "DELETE", url: `/years/${year}` });

  it("apaga o ano do path (200), com trava e log", async () => {
    vi.mocked(deleteYear).mockResolvedValue({
      year: 2026,
      deleted: { years: 1, ...counts },
    });

    const res = await del(2026);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      success: true,
      deleted: { years: 1, weeks: 53 },
    });
    expect(withYearLock).toHaveBeenCalledWith(
      2026,
      "deleteYear",
      expect.any(Function),
    );
    expect(saveOperationLog).toHaveBeenCalledOnce();
  });

  it("valida o ano do path (400)", async () => {
    const res = await del(1900);

    expect(res.statusCode).toBe(400);
    expect(deleteYear).not.toHaveBeenCalled();
  });

  it.each([
    ["ano inexistente", new YearNotFoundError(2026), 404],
    [
      "operação em andamento",
      new OperationInProgressError(2026, "createYear"),
      409,
    ],
  ])("traduz %s para o status certo", async (_name, error, status) => {
    vi.mocked(deleteYear).mockRejectedValue(error);

    const res = await del(2026);

    expect(res.statusCode).toBe(status);
  });

  it("responde 504 quando o Notion estoura o tempo", async () => {
    vi.mocked(deleteYear).mockRejectedValue(new RequestTimeoutError());

    const res = await del(2026);

    expect(res.statusCode).toBe(504);
    expect(res.json().message).toContain("apagar o que sobrou");
  });

  it("erro inesperado vira 500 sem vazar a mensagem interna", async () => {
    vi.mocked(deleteYear).mockRejectedValue(new Error("segredo interno"));

    const res = await del(2026);

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      success: false,
      message: "Erro ao apagar a rotina anual.",
    });
  });

  it("falha ao gravar o log não muda a resposta", async () => {
    vi.mocked(deleteYear).mockResolvedValue({
      year: 2026,
      deleted: { years: 1, ...counts },
    });
    vi.mocked(saveOperationLog).mockRejectedValue(new Error("db fora"));

    const res = await del(2026);

    expect(saveOperationLog).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("a antiga rota DELETE /deleteYear não existe mais (404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/deleteYear?year=2026",
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("operation_log", () => {
  it("grava sucesso com operação, status, código, resposta e duração", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: 2027,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });

    const res = await app.inject({
      method: "POST",
      url: "/years",
      payload: { year: 2027 },
    });

    expect(saveOperationLog).toHaveBeenCalledOnce();
    const entry = vi.mocked(saveOperationLog).mock.calls[0]![0];
    expect(entry).toMatchObject({
      year: 2027,
      operation: "createYear",
      status: "success",
      statusCode: 201,
      error: null,
      response: res.json(),
    });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.finishedAt.getTime()).toBeGreaterThanOrEqual(
      entry.startedAt.getTime(),
    );
  });

  it("grava erro conhecido com o código e a resposta enviada", async () => {
    vi.mocked(deleteYear).mockRejectedValue(new YearNotFoundError(1990));

    const res = await app.inject({ method: "DELETE", url: "/years/1990" });

    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 1990,
        operation: "deleteYear",
        status: "error",
        statusCode: 404,
        response: res.json(),
        error: new YearNotFoundError(1990).message,
      }),
    );
  });

  it("grava 500 com a mensagem interna em error, sem vazá-la na resposta", async () => {
    vi.mocked(repairYear).mockRejectedValue(new Error("segredo interno"));

    const res = await app.inject({
      method: "POST",
      url: "/years/2026/repair",
    });

    expect(res.body).not.toContain("segredo interno");
    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "repairYear",
        status: "error",
        statusCode: 500,
        error: "segredo interno",
        response: {
          success: false,
          message: "Erro ao reparar a rotina anual.",
        },
      }),
    );
  });

  it("grava a recusa da trava (409) com a operação que tentou rodar", async () => {
    vi.mocked(withYearLock).mockRejectedValue(
      new OperationInProgressError(2026, "createYear"),
    );

    await app.inject({ method: "DELETE", url: "/years/2026" });

    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "deleteYear",
        status: "error",
        statusCode: 409,
      }),
    );
    expect(deleteYear).not.toHaveBeenCalled();
  });

  it("não grava quando a validação do Zod recusa antes do handler", async () => {
    const res = await app.inject({ method: "DELETE", url: "/years/abc" });

    expect(res.statusCode).toBe(400);
    expect(saveOperationLog).not.toHaveBeenCalled();
  });
});
