-- CreateTable
CREATE TABLE "log_deleted_year" (
    "id" SERIAL NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_deleted_year_pkey" PRIMARY KEY ("id")
);
