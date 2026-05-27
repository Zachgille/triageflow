-- CreateEnum
CREATE TYPE "SlaBreachType" AS ENUM ('first_response', 'resolution');

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_breaches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "breach_type" "SlaBreachType" NOT NULL,
    "breached_at" TIMESTAMP(3) NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_breaches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_tenant_id_priority_key" ON "sla_policies"("tenant_id", "priority");

-- CreateIndex
CREATE INDEX "sla_policies_tenant_id_priority_idx" ON "sla_policies"("tenant_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "sla_breaches_tenant_id_ticket_id_breach_type_key" ON "sla_breaches"("tenant_id", "ticket_id", "breach_type");

-- CreateIndex
CREATE INDEX "sla_breaches_tenant_id_ticket_id_breach_type_idx" ON "sla_breaches"("tenant_id", "ticket_id", "breach_type");

-- CreateIndex
CREATE INDEX "sla_breaches_tenant_id_breached_at_idx" ON "sla_breaches"("tenant_id", "breached_at");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_breaches" ADD CONSTRAINT "sla_breaches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_breaches" ADD CONSTRAINT "sla_breaches_tenant_id_ticket_id_fkey" FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
