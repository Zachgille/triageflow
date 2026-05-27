-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- Add tenant-scoped unique key needed for composite ticket-comment relations.
CREATE UNIQUE INDEX "tickets_tenant_id_id_key" ON "tickets"("tenant_id", "id");

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID,
    "author_requester_id" UUID,
    "visibility" "CommentVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ticket_comments_exactly_one_author_check" CHECK (
        (
            "author_user_id" IS NOT NULL
            AND "author_requester_id" IS NULL
        )
        OR (
            "author_user_id" IS NULL
            AND "author_requester_id" IS NOT NULL
        )
    )
);

-- Indexes
CREATE INDEX "ticket_comments_tenant_id_ticket_id_created_at_idx" ON "ticket_comments"("tenant_id", "ticket_id", "created_at");
CREATE INDEX "ticket_comments_tenant_id_author_user_id_created_at_idx" ON "ticket_comments"("tenant_id", "author_user_id", "created_at");

-- Foreign keys
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_tenant_id_ticket_id_fkey" FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_tenant_id_author_user_id_fkey" FOREIGN KEY ("tenant_id", "author_user_id") REFERENCES "memberships"("tenant_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_tenant_id_author_requester_id_fkey" FOREIGN KEY ("tenant_id", "author_requester_id") REFERENCES "requesters"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
