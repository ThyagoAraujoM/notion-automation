-- Log único de operações (PF-003): substitui log_create_year e log_deleted_year.
-- Gerado com `prisma migrate diff` e editado à mão para COPIAR os dados antigos antes do DROP
-- (o Prisma sozinho só apagaria as tabelas).

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('createYear', 'repairYear', 'deleteYear');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "operation_log" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "operation" "OperationType" NOT NULL,
    "status" "OperationStatus" NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "operation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_log_year_started_at_idx" ON "operation_log"("year", "started_at");

-- Copia os logs antigos (só sucessos existiam). Duração desconhecida: duration_ms nulo.
-- O reparo gravava em log_create_year; ele se distingue pela chave "relinked" e respondia 200.
INSERT INTO "operation_log" ("year", "operation", "status", "status_code", "response", "started_at", "finished_at")
SELECT
    ("response"->>'year')::INTEGER,
    CASE WHEN "response" ? 'relinked' THEN 'repairYear' ELSE 'createYear' END::"OperationType",
    'success',
    CASE WHEN "response" ? 'relinked' THEN 200 ELSE 201 END,
    "response",
    "created_at",
    "created_at"
FROM "log_create_year"
ORDER BY "created_at";

INSERT INTO "operation_log" ("year", "operation", "status", "status_code", "response", "started_at", "finished_at")
SELECT
    ("response"->>'year')::INTEGER,
    'deleteYear',
    'success',
    200,
    "response",
    "created_at",
    "created_at"
FROM "log_deleted_year"
ORDER BY "created_at";

-- DropTable
DROP TABLE "log_create_year";

-- DropTable
DROP TABLE "log_deleted_year";
