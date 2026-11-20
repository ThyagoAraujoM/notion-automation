import { FastifyInstance } from "fastify";
import { createYearRoute } from "./create-year";
import { deleteYearRoute } from "./delete-year";
import { repairYearRoute } from "./repair-year";

/** Recurso `/years`: criar, reparar e apagar a rotina de um ano. */
export async function yearsRoutes(app: FastifyInstance) {
  await app.register(createYearRoute);
  await app.register(repairYearRoute);
  await app.register(deleteYearRoute);
}
