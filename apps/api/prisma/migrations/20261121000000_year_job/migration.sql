-- Jobs das operações de ano executadas em segundo plano (PF-001).

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "year_job" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "operation" "OperationType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'running',
    "params" JSONB NOT NULL,
    "status_code" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "year_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "year_job_year_created_at_idx" ON "year_job"("year", "created_at");

