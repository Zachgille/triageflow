-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "requesters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "assignee_user_id" UUID,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "first_response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "first_responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "requesters_tenant_id_id_key" ON "requesters"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "requesters_tenant_id_email_key" ON "requesters"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_status_created_at_idx" ON "tickets"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_assignee_user_id_status_created_at_idx" ON "tickets"("tenant_id", "assignee_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_priority_created_at_idx" ON "tickets"("tenant_id", "priority", "created_at");

-- AddForeignKey
ALTER TABLE "requesters" ADD CONSTRAINT "requesters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_requester_id_fkey" FOREIGN KEY ("tenant_id", "requester_id") REFERENCES "requesters"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_assignee_user_id_fkey" FOREIGN KEY ("tenant_id", "assignee_user_id") REFERENCES "memberships"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
