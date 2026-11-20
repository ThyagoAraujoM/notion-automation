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
import { createYearJob, findYearJob, finishYearJob } from "@/db/year-job";
import { buildApp } from "@/http/app";
import { settleYearJobs } from "@/http/year-job";
import { MissingTemplatesError } from "@/integrations/notion/helpers";
import { createYear } from "@/services/create-year";
import { deleteYear } from "@/services/delete-year";
import { repairYear } from "@/services/repair-year";
import {
  OperationInProgressError,
  YearAlreadyExistsError,
  YearNotFoundError,
} from "@/services/shared/errors";
import { acquireYearLock } from "@/services/shared/year-lock";

// Nada de Notion nem Postgres: services, trava, jobs e log são substituídos por mocks.
vi.mock("@/services/create-year", () => ({ createYear: vi.fn() }));
vi.mock("@/services/repair-year", () => ({ repairYear: vi.fn() }));
vi.mock("@/services/delete-year", () => ({ deleteYear: vi.fn() }));
vi.mock("@/db/operation-log", () => ({ saveOperationLog: vi.fn() }));
vi.mock("@/services/shared/year-lock", () => ({ acquireYearLock: vi.fn() }));
vi.mock("@/db/year-job", () => ({
  createYearJob: vi.fn(),
  finishYearJob: vi.fn(),
  findYearJob: vi.fn(),
}));

const JOB_ID = "3f1c2b8e-9a4d-4c7e-8f21-6b5a0d9e1c34";
const counts = { quarters: 4, months: 12, weeks: 53, days: 365 };
const currentYear = new Date().getFullYear();
const release = vi.fn();

const app = buildApp({ logger: false });

beforeAll(() => app.ready());
afterAll(() => app.close());

beforeEach(() => {
  vi.clearAllMocks();
  // Por padrão a trava é obtida e o job é gravado
  release.mockResolvedValue(undefined);
  vi.mocked(acquireYearLock).mockResolvedValue(release);
  vi.mocked(createYearJob).mockResolvedValue({ id: JOB_ID } as never);
  vi.mocked(finishYearJob).mockResolvedValue({} as never);
  vi.mocked(saveOperationLog).mockResolvedValue({} as never);
});

/** Espera o job terminar e devolve o que foi gravado nele. */
async function jobOutcome() {
  await settleYearJobs();
  expect(finishYearJob).toHaveBeenCalledOnce();
  const [id, data] = vi.mocked(finishYearJob).mock.calls[0]!;
  expect(id).toBe(JOB_ID);
  return data;
}

/** Promise controlada pelo teste, para segurar o service "rodando". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("POST /years", () => {
  const post = (payload?: object) =>
    app.inject({ method: "POST", url: "/years", payload });

  const created = (year = 2027) => ({
    year,
    yearPageId: "page-1",
    created: { years: 1, ...counts },
  });

  it("aceita com 202, jobId e Location, travando o ano e gravando o job", async () => {
    vi.mocked(createYear).mockResolvedValue(created());

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(202);
    expect(res.headers.location).toBe(`/years/jobs/${JOB_ID}`);
    expect(res.json()).toMatchObject({
      success: true,
      jobId: JOB_ID,
      year: 2027,
      operation: "createYear",
      status: "running",
      statusUrl: `/years/jobs/${JOB_ID}`,
    });
    expect(acquireYearLock).toHaveBeenCalledWith(2027, "createYear");
    expect(createYearJob).toHaveBeenCalledWith({
      year: 2027,
      operation: "createYear",
      params: { startToday: false },
    });
    expect(createYear).toHaveBeenCalledWith(2027, false);
  });

  it("responde antes de a operação terminar e só solta a trava no fim do job", async () => {
    const running = deferred<ReturnType<typeof created>>();
    vi.mocked(createYear).mockReturnValue(running.promise);

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(202);
    expect(finishYearJob).not.toHaveBeenCalled();
    expect(saveOperationLog).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();

    running.resolve(created());
    await jobOutcome();
    expect(saveOperationLog).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("job concluído grava 201 e o corpo que a rota síncrona daria", async () => {
    vi.mocked(createYear).mockResolvedValue(created());

    await post({ year: 2027 });

    expect(await jobOutcome()).toMatchObject({
      status: "succeeded",
      statusCode: 201,
      error: null,
      result: {
        success: true,
        year: 2027,
        yearPageId: "page-1",
        created: { years: 1, days: 365 },
      },
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it("sem body usa o ano atual e o ano inteiro", async () => {
    vi.mocked(createYear).mockResolvedValue(created(currentYear));

    const res = await app.inject({ method: "POST", url: "/years" });

    expect(res.statusCode).toBe(202);
    expect(createYear).toHaveBeenCalledWith(currentYear, false);
  });

  it("repassa startToday: 1 como true", async () => {
    vi.mocked(createYear).mockResolvedValue(created(currentYear));

    const res = await post({ startToday: 1 });

    expect(res.statusCode).toBe(202);
    expect(res.json().message).toContain("a partir de hoje");
    expect(createYear).toHaveBeenCalledWith(currentYear, true);
    expect((await jobOutcome()).result).toMatchObject({
      message: expect.stringContaining("a partir de hoje"),
    });
  });

  it("ignora o antigo parâmetro repair (o Zod descarta a chave e cria)", async () => {
    vi.mocked(createYear).mockResolvedValue(created());

    const res = await post({ year: 2027, repair: 1 });

    expect(res.statusCode).toBe(202);
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
    expect(acquireYearLock).not.toHaveBeenCalled();
    expect(createYear).not.toHaveBeenCalled();
  });

  it("startToday fora do ano atual responde 400 na hora, sem travar nem criar job", async () => {
    const res = await post({ year: currentYear + 1, startToday: 1 });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("startToday");
    expect(acquireYearLock).not.toHaveBeenCalled();
    expect(createYearJob).not.toHaveBeenCalled();
    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", statusCode: 400 }),
    );
  });

  it("operação em andamento responde 409 na hora, sem criar job", async () => {
    const error = new OperationInProgressError(2027, "deleteYear");
    vi.mocked(acquireYearLock).mockRejectedValue(error);

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ success: false, message: error.message });
    expect(createYearJob).not.toHaveBeenCalled();
    expect(createYear).not.toHaveBeenCalled();
    expect(saveOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", statusCode: 409 }),
    );
  });

  it("falha ao gravar o job responde 500 e solta a trava", async () => {
    vi.mocked(createYearJob).mockRejectedValue(new Error("db fora"));

    const res = await post({ year: 2027 });

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("db fora");
    expect(release).toHaveBeenCalledOnce();
    expect(createYear).not.toHaveBeenCalled();
  });

  it.each([
    ["ano já existe", new YearAlreadyExistsError(2027), 409],
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
  ])(
    "job com %s termina failed com o status certo",
    async (_name, error, status) => {
      vi.mocked(createYear).mockRejectedValue(error);

      const res = await post({ year: 2027 });

      expect(res.statusCode).toBe(202);
      expect(await jobOutcome()).toEqual({
        status: "failed",
        statusCode: status,
        result: { success: false, message: error.message },
        error: error.message,
        finishedAt: expect.any(Date),
      });
      expect(saveOperationLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", statusCode: status }),
      );
      expect(release).toHaveBeenCalledOnce();
    },
  );

  it("job com timeout do Notion termina 504 com rollback na mensagem", async () => {
    vi.mocked(createYear).mockRejectedValue(new RequestTimeoutError());

    await post({ year: 2027 });

    const outcome = await jobOutcome();
    expect(outcome.statusCode).toBe(504);
    expect(JSON.stringify(outcome.result)).toContain("lixeira");
    expect(JSON.stringify(outcome.result)).toContain("POST /years/2027/repair");
  });

  it("erro que não pertence à operação (404) vira 500 no job", async () => {
    vi.mocked(createYear).mockRejectedValue(new YearNotFoundError(2027));

    await post({ year: 2027 });

    expect(await jobOutcome()).toMatchObject({
      status: "failed",
      statusCode: 500,
      result: { success: false, message: "Erro ao criar a rotina anual." },
    });
  });

  it("erro inesperado vira 500 sem vazar a mensagem interna no resultado", async () => {
    vi.mocked(createYear).mockRejectedValue(new Error("segredo interno"));

    await post({ year: 2027 });

    const outcome = await jobOutcome();
    expect(outcome.statusCode).toBe(500);
    expect(JSON.stringify(outcome.result)).not.toContain("segredo interno");
    expect(outcome.error).toBe("segredo interno");
    expect(release).toHaveBeenCalledOnce();
  });

  it("falha ao finalizar o job ou ao gravar o log não derruba nada e solta a trava", async () => {
    vi.mocked(createYear).mockResolvedValue(created());
    vi.mocked(finishYearJob).mockRejectedValue(new Error("db fora"));
    vi.mocked(saveOperationLog).mockRejectedValue(new Error("db fora"));

    const res = await post({ year: 2027 });
    await settleYearJobs();

    expect(res.statusCode).toBe(202);
    expect(saveOperationLog).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
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
});

describe("POST /years/:year/repair", () => {
  const repair = (year: string | number, payload?: object) =>
    app.inject({ method: "POST", url: `/years/${year}/repair`, payload });

  const repaired = {
    year: 2026,
    yearPageId: "p",
    created: { quarters: 0, months: 1, weeks: 2, days: 3 },
    relinked: { months: 0, weeks: 1, days: 0 },
  };

  it("aceita com 202 e o job termina 200 com created e relinked", async () => {
    vi.mocked(repairYear).mockResolvedValue(repaired);

    const res = await repair(2026);

    expect(res.statusCode).toBe(202);
    expect(res.headers.location).toBe(`/years/jobs/${JOB_ID}`);
    expect(res.json()).toMatchObject({
      operation: "repairYear",
      year: 2026,
    });
    expect(acquireYearLock).toHaveBeenCalledWith(2026, "repairYear");
    expect(repairYear).toHaveBeenCalledWith(2026, false);
    expect(await jobOutcome()).toMatchObject({
      status: "succeeded",
      statusCode: 200,
      result: { success: true, created: { days: 3 }, relinked: { weeks: 1 } },
    });
  });

  it("repassa startToday: 1", async () => {
    vi.mocked(repairYear).mockResolvedValue({ ...repaired, year: currentYear });

    await repair(currentYear, { startToday: 1 });

    expect(repairYear).toHaveBeenCalledWith(currentYear, true);
    expect(createYearJob).toHaveBeenCalledWith(
      expect.objectContaining({ params: { startToday: true } }),
    );
  });

  it("valida o ano do path (400)", async () => {
    const res = await repair("abc");

    expect(res.statusCode).toBe(400);
    expect(repairYear).not.toHaveBeenCalled();
  });

  it("startToday fora do ano atual responde 400 na hora", async () => {
    const res = await repair(currentYear - 1, { startToday: 1 });

    expect(res.statusCode).toBe(400);
    expect(acquireYearLock).not.toHaveBeenCalled();
  });

  it("operação em andamento responde 409 na hora", async () => {
    vi.mocked(acquireYearLock).mockRejectedValue(
      new OperationInProgressError(2026, "createYear"),
    );

    const res = await repair(2026);

    expect(res.statusCode).toBe(409);
    expect(repairYear).not.toHaveBeenCalled();
  });

  it.each([
    ["ano inexistente", new YearNotFoundError(2026), 404],
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
    ["timeout do Notion", new RequestTimeoutError(), 504],
    ["erro inesperado", new Error("segredo interno"), 500],
  ])("job com %s termina failed (%s)", async (_name, error, status) => {
    vi.mocked(repairYear).mockRejectedValue(error);

    await repair(2026);

    const outcome = await jobOutcome();
    expect(outcome).toMatchObject({ status: "failed", statusCode: status });
    expect(JSON.stringify(outcome.result)).not.toContain("segredo interno");
    expect(release).toHaveBeenCalledOnce();
  });
});

describe("DELETE /years/:year", () => {
  const del = (year: string | number) =>
    app.inject({ method: "DELETE", url: `/years/${year}` });

  it("aceita com 202 e o job termina 200 com a contagem", async () => {
    vi.mocked(deleteYear).mockResolvedValue({
      year: 2026,
      deleted: { years: 1, ...counts },
    });

    const res = await del(2026);

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ operation: "deleteYear", year: 2026 });
    expect(acquireYearLock).toHaveBeenCalledWith(2026, "deleteYear");
    expect(createYearJob).toHaveBeenCalledWith({
      year: 2026,
      operation: "deleteYear",
      params: {},
    });
    expect(await jobOutcome()).toMatchObject({
      status: "succeeded",
      statusCode: 200,
      result: { success: true, deleted: { years: 1, weeks: 53 } },
    });
  });

  it("valida o ano do path (400)", async () => {
    const res = await del(1900);

    expect(res.statusCode).toBe(400);
    expect(deleteYear).not.toHaveBeenCalled();
  });

  it("operação em andamento responde 409 na hora", async () => {
    vi.mocked(acquireYearLock).mockRejectedValue(
      new OperationInProgressError(2026, "createYear"),
    );

    const res = await del(2026);

    expect(res.statusCode).toBe(409);
    expect(deleteYear).not.toHaveBeenCalled();
  });

  it.each([
    ["ano inexistente", new YearNotFoundError(2026), 404],
    ["timeout do Notion", new RequestTimeoutError(), 504],
    ["erro inesperado", new Error("segredo interno"), 500],
  ])("job com %s termina failed (%s)", async (_name, error, status) => {
    vi.mocked(deleteYear).mockRejectedValue(error);

    await del(2026);

    const outcome = await jobOutcome();
    expect(outcome).toMatchObject({ status: "failed", statusCode: status });
    expect(JSON.stringify(outcome.result)).not.toContain("segredo interno");
    if (status === 504) {
      expect(JSON.stringify(outcome.result)).toContain("apagar o que sobrou");
    }
  });

  it("a antiga rota DELETE /deleteYear não existe mais (404)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/deleteYear?year=2026",
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /years/jobs/:jobId", () => {
  const get = (id: string) =>
    app.inject({ method: "GET", url: `/years/jobs/${id}` });

  const createdAt = new Date("2026-11-20T10:00:00.000Z");

  it("job em andamento: status running e campos de resultado nulos", async () => {
    vi.mocked(findYearJob).mockResolvedValue({
      id: JOB_ID,
      year: 2027,
      operation: "createYear",
      status: "running",
      params: { startToday: false },
      statusCode: null,
      result: null,
      error: null,
      createdAt,
      finishedAt: null,
    });

    const res = await get(JOB_ID);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      jobId: JOB_ID,
      year: 2027,
      operation: "createYear",
      status: "running",
      createdAt: createdAt.toISOString(),
      finishedAt: null,
      durationMs: null,
      statusCode: null,
      result: null,
    });
    expect(findYearJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("job concluído: código, corpo completo e duração, sem a mensagem interna", async () => {
    const result = {
      success: true,
      message: "Rotina de 2027 criada com sucesso.",
      year: 2027,
      yearPageId: "p",
      created: { years: 1, ...counts },
    };
    vi.mocked(findYearJob).mockResolvedValue({
      id: JOB_ID,
      year: 2027,
      operation: "createYear",
      status: "succeeded",
      params: { startToday: false },
      statusCode: 201,
      result,
      error: "interno",
      createdAt,
      finishedAt: new Date(createdAt.getTime() + 400_000),
    });

    const res = await get(JOB_ID);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "succeeded",
      statusCode: 201,
      durationMs: 400_000,
      result,
    });
    expect(res.body).not.toContain("interno");
  });

  it("job inexistente responde 404", async () => {
    vi.mocked(findYearJob).mockResolvedValue(null);

    const res = await get(JOB_ID);

    expect(res.statusCode).toBe(404);
    expect(res.json().success).toBe(false);
  });

  it("id que não é UUID responde 400 sem consultar o banco", async () => {
    const res = await get("123");

    expect(res.statusCode).toBe(400);
    expect(findYearJob).not.toHaveBeenCalled();
  });
});

describe("operation_log", () => {
  it("grava uma linha só, no fim do job, com o código final e a resposta", async () => {
    vi.mocked(createYear).mockResolvedValue({
      year: 2027,
      yearPageId: "p",
      created: { years: 1, ...counts },
    });

    await app.inject({
      method: "POST",
      url: "/years",
      payload: { year: 2027 },
    });
    const outcome = await jobOutcome();

    expect(saveOperationLog).toHaveBeenCalledOnce();
    const entry = vi.mocked(saveOperationLog).mock.calls[0]![0];
    expect(entry).toMatchObject({
      year: 2027,
      operation: "createYear",
      status: "success",
      statusCode: 201,
      error: null,
      response: outcome.result,
    });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("grava 500 do job com a mensagem interna em error", async () => {
    vi.mocked(repairYear).mockRejectedValue(new Error("segredo interno"));

    await app.inject({ method: "POST", url: "/years/2026/repair" });
    await settleYearJobs();

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

  it("não grava quando a validação do Zod recusa antes do handler", async () => {
    const res = await app.inject({ method: "DELETE", url: "/years/abc" });

    expect(res.statusCode).toBe(400);
    expect(saveOperationLog).not.toHaveBeenCalled();
  });
});
