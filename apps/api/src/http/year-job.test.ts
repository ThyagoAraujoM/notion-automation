import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createYearJob, failYearJobs, finishYearJob } from "@/db/year-job";
import { acquireYearLock } from "@/services/shared/year-lock";
import { failRunningYearJobs, settleYearJobs, startYearJob } from "./year-job";

vi.mock("@/db/year-job", () => ({
  createYearJob: vi.fn(),
  finishYearJob: vi.fn(),
  failYearJobs: vi.fn(),
}));
vi.mock("@/services/shared/year-lock", () => ({ acquireYearLock: vi.fn() }));

const release = vi.fn();
const request = { log: { error: vi.fn() } } as never;
const log = vi.fn();

/** Terminadores dos jobs pendentes de cada teste (o estado de `running` é do módulo). */
const finishers: Array<() => void> = [];

afterEach(async () => {
  finishers.splice(0).forEach((finish) => finish());
  await settleYearJobs();
});

beforeEach(() => {
  vi.clearAllMocks();
  release.mockResolvedValue(undefined);
  log.mockResolvedValue(undefined);
  vi.mocked(acquireYearLock).mockResolvedValue(release);
  vi.mocked(finishYearJob).mockResolvedValue({} as never);
  vi.mocked(failYearJobs).mockResolvedValue(undefined);
});

/** Inicia um job cujo `run` só termina quando `finish()` é chamado. */
async function startPendingJob(id: string, year: number) {
  vi.mocked(createYearJob).mockResolvedValueOnce({ id } as never);
  const run = () =>
    new Promise<void>((resolve) => {
      finishers.push(resolve);
    });
  await startYearJob({
    request,
    year,
    operation: "deleteYear",
    params: {},
    log,
    run,
    toOutcome: () => ({
      statusCode: 200,
      body: { success: true, message: "ok" },
    }),
  });
}

describe("failRunningYearJobs", () => {
  it("marca os jobs em andamento como falhos e solta as travas sem esperar o fim deles (CA1)", async () => {
    await startPendingJob("job-1", 2090);
    await startPendingJob("job-2", 2091);

    await failRunningYearJobs();

    expect(failYearJobs).toHaveBeenCalledWith(["job-1", "job-2"]);
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("não toca no banco quando nenhum job está em andamento", async () => {
    await failRunningYearJobs();

    expect(failYearJobs).not.toHaveBeenCalled();
  });

  it("solta as travas mesmo se gravar a falha der erro", async () => {
    await startPendingJob("job-3", 2092);
    vi.mocked(failYearJobs).mockRejectedValue(new Error("banco fora"));

    await expect(failRunningYearJobs()).rejects.toThrow("banco fora");

    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("gravação do desfecho do job", () => {
  /** Inicia um job que termina na hora com sucesso e espera ele acabar (com timers falsos). */
  async function runJobToEnd() {
    vi.mocked(createYearJob).mockResolvedValueOnce({ id: "job-9" } as never);
    await startYearJob({
      request,
      year: 2093,
      operation: "deleteYear",
      params: {},
      log,
      run: async () => undefined,
      toOutcome: () => ({
        statusCode: 200,
        body: { success: true, message: "ok" },
      }),
    });
    await vi.runAllTimersAsync();
    await settleYearJobs();
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retenta e para quando uma tentativa dá certo (CA3)", async () => {
    vi.mocked(finishYearJob)
      .mockRejectedValueOnce(new Error("conexão caiu"))
      .mockResolvedValue({} as never);

    await runJobToEnd();

    expect(finishYearJob).toHaveBeenCalledTimes(2);
    expect(finishYearJob).toHaveBeenLastCalledWith(
      "job-9",
      expect.objectContaining({ status: "succeeded" }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("esgotadas as tentativas, marca o job como failed (CA3)", async () => {
    vi.mocked(finishYearJob)
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockResolvedValue({} as never);

    await runJobToEnd();

    expect(finishYearJob).toHaveBeenCalledTimes(4);
    expect(finishYearJob).toHaveBeenLastCalledWith(
      "job-9",
      expect.objectContaining({
        status: "failed",
        statusCode: 500,
        result: expect.objectContaining({ success: false }),
      }),
    );
    expect(release).toHaveBeenCalledTimes(1);
  });
});
