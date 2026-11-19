-- CreateTable
CREATE TABLE "year_operation_lock" (
    "year" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_operation_lock_pkey" PRIMARY KEY ("year")
);
