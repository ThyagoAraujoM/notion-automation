import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import {
  releaseYearLock,
  tryAcquireYearLock,
  YEAR_LOCK_TTL_MS,
} from "./year-lock";

// Sem Postgres: só os métodos do Prisma usados pela trava.
vi.mock("./prisma", () => ({
  prisma: {
    yearOperationLock: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const lock = vi.mocked(prisma.yearOperationLock);

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("tryAcquireYearLock", () => {
  it("adquire quando o ano está livre", async () => {
    lock.deleteMany.mockResolvedValue({ count: 0 });
    lock.create.mockResolvedValue({
      year: 2090,
      operation: "createYear",
      startedAt: new Date(),
    });

    await expect(tryAcquireYearLock(2090, "createYear")).resolves.toEqual({
      acquired: true,
    });
    expect(lock.create).toHaveBeenCalledWith({
      data: { year: 2090, operation: "createYear" },
    });
  });

  it("descarta antes a trava vencida pelo TTL (só a do próprio ano)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2090-06-01T12:00:00Z"));
    lock.deleteMany.mockResolvedValue({ count: 1 });
    lock.create.mockResolvedValue({
      year: 2090,
      operation: "repairYear",
      startedAt: new Date(),
    });

    await tryAcquireYearLock(2090, "repairYear");

    expect(lock.deleteMany).toHaveBeenCalledWith({
      where: {
        year: 2090,
        startedAt: { lt: new Date(Date.now() - YEAR_LOCK_TTL_MS) },
      },
    });
    // O descarte vem antes da tentativa de criar
    expect(lock.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      lock.create.mock.invocationCallOrder[0]!,
    );
  });

  it("recusa e diz quem segura quando o banco acusa chave duplicada (P2002)", async () => {
    lock.deleteMany.mockResolvedValue({ count: 0 });
    lock.create.mockRejectedValue(uniqueViolation());
    lock.findUnique.mockResolvedValue({
      year: 2090,
      operation: "deleteYear",
      startedAt: new Date(),
    });

    await expect(tryAcquireYearLock(2090, "createYear")).resolves.toEqual({
      acquired: false,
      heldBy: "deleteYear",
    });
    expect(lock.findUnique).toHaveBeenCalledWith({ where: { year: 2090 } });
  });

  it("usa um texto genérico se a trava sumiu entre a recusa e a leitura", async () => {
    lock.deleteMany.mockResolvedValue({ count: 0 });
    lock.create.mockRejectedValue(uniqueViolation());
    lock.findUnique.mockResolvedValue(null);

    await expect(tryAcquireYearLock(2090, "createYear")).resolves.toEqual({
      acquired: false,
      heldBy: "outra operação",
    });
  });

  it("propaga qualquer outro erro do banco", async () => {
    const boom = new Error("conexão perdida");
    lock.deleteMany.mockResolvedValue({ count: 0 });
    lock.create.mockRejectedValue(boom);

    await expect(tryAcquireYearLock(2090, "createYear")).rejects.toBe(boom);
  });
});

describe("releaseYearLock", () => {
  it("apaga só a trava do ano", async () => {
    lock.deleteMany.mockResolvedValue({ count: 1 });

    await releaseYearLock(2090);

    expect(lock.deleteMany).toHaveBeenCalledWith({ where: { year: 2090 } });
  });
});
