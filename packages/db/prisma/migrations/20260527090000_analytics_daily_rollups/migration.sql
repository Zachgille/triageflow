-- CreateTable
CREATE TABLE "analytics_daily_rollups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_count" INTEGER NOT NULL DEFAULT 0,
    "closed_count" INTEGER NOT NULL DEFAULT 0,
    "public_comment_count" INTEGER NOT NULL DEFAULT 0,
    "internal_note_count" INTEGER NOT NULL DEFAULT 0,
    "first_response_sla_breach_count" INTEGER NOT NULL DEFAULT 0,
    "resolution_sla_breach_count" INTEGER NOT NULL DEFAULT 0,
    "avg_first_response_seconds" DOUBLE PRECISION,
    "avg_resolution_seconds" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_rollups_tenant_id_date_key" ON "analytics_daily_rollups"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "analytics_daily_rollups_tenant_id_date_idx" ON "analytics_daily_rollups"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "analytics_daily_rollups" ADD CONSTRAINT "analytics_daily_rollups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
