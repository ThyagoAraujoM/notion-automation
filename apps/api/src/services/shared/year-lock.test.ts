import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releaseYearLock, tryAcquireYearLock } from "@/db/year-lock";
import { OperationInProgressError } from "./errors";
import { acquireYearLock } from "./year-lock";

vi.mock("@/db/year-lock", () => ({
  tryAcquireYearLock: vi.fn(),
  releaseYearLock: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("acquireYearLock", () => {
  it("devolve a função que libera a trava do ano", async () => {
    vi.mocked(tryAcquireYearLock).mockResolvedValue({ acquired: true });
    vi.mocked(releaseYearLock).mockResolvedValue(undefined);

    const release = await acquireYearLock(2090, "createYear");
    expect(tryAcquireYearLock).toHaveBeenCalledWith(2090, "createYear");
    expect(releaseYearLock).not.toHaveBeenCalled();

    await release();
    expect(releaseYearLock).toHaveBeenCalledWith(2090);
  });

  it("lança OperationInProgressError com o nome da operação em andamento", async () => {
    vi.mocked(tryAcquireYearLock).mockResolvedValue({
      acquired: false,
      heldBy: "repairYear",
    });

    const error = await acquireYearLock(2090, "createYear").catch((e) => e);

    expect(error).toBeInstanceOf(OperationInProgressError);
    expect(error.message).toContain("reparo do ano");
    expect(error.message).toContain("2090");
  });

  it("o release nunca lança: falha ao liberar só é registrada no log", async () => {
    vi.mocked(tryAcquireYearLock).mockResolvedValue({ acquired: true });
    vi.mocked(releaseYearLock).mockRejectedValue(new Error("banco fora"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const release = await acquireYearLock(2090, "deleteYear");

    await expect(release()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
