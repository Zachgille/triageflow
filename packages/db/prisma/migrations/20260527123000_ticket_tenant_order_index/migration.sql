-- Benchmark-driven index for unfiltered tenant ticket queues and cursor pages.
-- Supports WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT ?.
CREATE INDEX "tickets_tenant_id_created_at_id_desc_idx"
  ON "tickets" ("tenant_id", "created_at" DESC, "id" DESC);
