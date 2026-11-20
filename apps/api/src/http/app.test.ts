import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";

// Só a especificação OpenAPI: nenhuma rota é executada, mas o Prisma fica de fora mesmo assim.
vi.mock("@/db/operation-log", () => ({ saveOperationLog: vi.fn() }));
vi.mock("@/services/shared/year-lock", () => ({ acquireYearLock: vi.fn() }));
vi.mock("@/db/year-job", () => ({ findYearJob: vi.fn() }));

type Operation = {
  tags?: string[];
  responses: Record<string, unknown>;
  requestBody?: { content: Record<string, { schema: unknown }> };
};
type Spec = {
  tags: { name: string }[];
  paths: Record<string, Record<string, Operation>>;
};

const app = buildApp({ logger: false });
let spec: Spec;

beforeAll(async () => {
  await app.ready();
  const res = await app.inject({ method: "GET", url: "/docs/json" });
  expect(res.statusCode).toBe(200);
  spec = res.json();
});
afterAll(() => app.close());

describe("OpenAPI (/docs/json)", () => {
  it("lista exatamente as rotas REST, sem as antigas", () => {
    const routes = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((m) => `${m.toUpperCase()} ${path}`),
    );
    expect(routes.sort()).toEqual([
      "DELETE /years/{year}",
      "GET /databases/{databaseId}/schema",
      "GET /years/jobs/{jobId}",
      "POST /years",
      "POST /years/{year}/repair",
    ]);
  });

  it("agrupa as rotas de /years na tag Rotina, declarada no topo", () => {
    expect(spec.tags.map((t) => t.name)).toEqual(["Rotina", "Database"]);
    expect(spec.paths["/years"]!.post!.tags).toEqual(["Rotina"]);
    expect(spec.paths["/years/{year}"]!.delete!.tags).toEqual(["Rotina"]);
    expect(spec.paths["/years/jobs/{jobId}"]!.get!.tags).toEqual(["Rotina"]);
  });

  it("documenta o body opcional (nullish) com os campos year e startToday", () => {
    const body = spec.paths["/years"]!.post!.requestBody;
    const schema = JSON.stringify(body?.content["application/json"]?.schema);

    expect(schema).toContain("year");
    expect(schema).toContain("startToday");
    expect(schema).not.toContain("repair");
  });

  it("declara os status de cada rota (202 nas operações de ano)", () => {
    const statuses = (path: string, method: string) =>
      Object.keys(spec.paths[path]![method]!.responses).sort();

    // Operações longas respondem 202 (job em segundo plano); o resultado sai no GET do job
    const accepted = ["202", "400", "409", "500"];
    expect(statuses("/years", "post")).toEqual(accepted);
    expect(statuses("/years/{year}/repair", "post")).toEqual(accepted);
    expect(statuses("/years/{year}", "delete")).toEqual(accepted);
    expect(statuses("/years/jobs/{jobId}", "get")).toEqual([
      "200",
      "400",
      "404",
      "500",
    ]);
  });
});
