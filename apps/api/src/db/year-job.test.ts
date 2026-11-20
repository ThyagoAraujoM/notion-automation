import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { failInterruptedYearJobs, INTERRUPTED_JOB_MESSAGE } from "./year-job";

// Sem Postgres: só o método do Prisma usado aqui.
vi.mock("./prisma", () => ({
  prisma: { yearJob: { updateMany: vi.fn() } },
}));

beforeEach(() => vi.clearAllMocks());

describe("failInterruptedYearJobs", () => {
  it("marca só os jobs running como failed, com 500 e a mensagem de interrupção", async () => {
    vi.mocked(prisma.yearJob.updateMany).mockResolvedValue({ count: 2 });

    await failInterruptedYearJobs();

    expect(prisma.yearJob.updateMany).toHaveBeenCalledWith({
      where: { status: "running" },
      data: expect.objectContaining({
        status: "failed",
        statusCode: 500,
        result: { success: false, message: INTERRUPTED_JOB_MESSAGE },
        finishedAt: expect.any(Date),
      }),
    });
    expect(INTERRUPTED_JOB_MESSAGE).toContain("repair");
  });
});
