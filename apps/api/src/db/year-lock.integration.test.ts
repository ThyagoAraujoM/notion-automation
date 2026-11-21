// Integração com o Postgres real: prova que a chave primária impede duas travas do mesmo
// ano. Rode com `pnpm db:up` e `pnpm --filter=@notion-automation/api test:integration`.
// Só mexe nos anos 2091–2093 (fora do uso real) e nunca chama `clearYearLocks`.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  releaseYearLock,
  tryAcquireYearLock,
  YEAR_LOCK_TTL_MS,
} from "./year-lock";

const YEARS = [2091, 2092, 2093];
const cleanup = () =>
  prisma.yearOperationLock.deleteMany({ where: { year: { in: YEARS } } });

beforeAll(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("trava por ano (Postgres real)", () => {
  it("em aquisições simultâneas do mesmo ano, só uma vence", async () => {
    const results = await Promise.all(
      (["createYear", "repairYear", "deleteYear", "createYear"] as const).map(
        (operation) => tryAcquireYearLock(2091, operation),
      ),
    );

    expect(results.filter((r) => r.acquired)).toHaveLength(1);
    const losers = results.filter((r) => !r.acquired);
    expect(losers).toHaveLength(3);
    // Quem perdeu recebe a operação de quem venceu
    const stored = await prisma.yearOperationLock.findUniqueOrThrow({
      where: { year: 2091 },
    });
    for (const loser of losers) {
      expect(loser).toEqual({ acquired: false, heldBy: stored.operation });
    }
  });

  it("anos diferentes não se bloqueiam", async () => {
    const [a, b] = await Promise.all([
      tryAcquireYearLock(2091, "createYear"),
      tryAcquireYearLock(2092, "createYear"),
    ]);

    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
  });

  it("liberar permite adquirir de novo", async () => {
    await tryAcquireYearLock(2091, "createYear");
    expect((await tryAcquireYearLock(2091, "repairYear")).acquired).toBe(false);

    await releaseYearLock(2091);

    expect(await tryAcquireYearLock(2091, "repairYear")).toEqual({
      acquired: true,
    });
  });

  it("reaproveita a trava vencida pelo TTL (processo que morreu)", async () => {
    await prisma.yearOperationLock.create({
      data: {
        year: 2093,
        operation: "createYear",
        startedAt: new Date(Date.now() - YEAR_LOCK_TTL_MS - 60_000),
      },
    });

    expect(await tryAcquireYearLock(2093, "deleteYear")).toEqual({
      acquired: true,
    });
    const stored = await prisma.yearOperationLock.findUniqueOrThrow({
      where: { year: 2093 },
    });
    expect(stored.operation).toBe("deleteYear");
  });

  it("não reaproveita uma trava ainda dentro do TTL", async () => {
    await prisma.yearOperationLock.create({
      data: {
        year: 2093,
        operation: "createYear",
        startedAt: new Date(Date.now() - YEAR_LOCK_TTL_MS + 60_000),
      },
    });

    expect(await tryAcquireYearLock(2093, "deleteYear")).toEqual({
      acquired: false,
      heldBy: "createYear",
    });
  });
});
