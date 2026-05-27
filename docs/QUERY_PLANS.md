# Query Plan Capture

Use these SQL snippets after running the large benchmark seed. Replace placeholder ids with values printed by:

```powershell
corepack pnpm db:bench:counts
```

Run through `psql`, a database GUI, or another PostgreSQL client connected to the local `DATABASE_URL`.

## Ticket Lists

Tenant list ordered by cursor keys:

Expected index after `20260527123000_ticket_tenant_order_index`:

- `tickets_tenant_id_created_at_id_desc_idx`

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

Tenant and status:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
  AND status = 'OPEN'
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

Tenant and priority:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
  AND priority = 'HIGH'
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

Tenant, assignee, and status:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
  AND assignee_user_id = '<assignee-user-id>'::uuid
  AND status = 'OPEN'
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

Cursor second page condition:

Expected index after `20260527123000_ticket_tenant_order_index`:

- `tickets_tenant_id_created_at_id_desc_idx`

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
  AND (
    created_at < '<cursor-created-at>'::timestamptz
    OR (created_at = '<cursor-created-at>'::timestamptz AND id < '<cursor-id>'::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

Status-filtered cursor second page:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, status, priority, assignee_user_id, created_at
FROM tickets
WHERE tenant_id = '<tenant-id>'::uuid
  AND status = 'OPEN'
  AND (
    created_at < '<cursor-created-at>'::timestamptz
    OR (created_at = '<cursor-created-at>'::timestamptz AND id < '<cursor-id>'::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT 51;
```

## Comments

Tenant and ticket timeline:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, ticket_id, visibility, created_at
FROM ticket_comments
WHERE tenant_id = '<tenant-id>'::uuid
  AND ticket_id = '<ticket-id>'::uuid
ORDER BY created_at ASC, id ASC
LIMIT 51;
```

Comment cursor next page:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id, ticket_id, visibility, created_at
FROM ticket_comments
WHERE tenant_id = '<tenant-id>'::uuid
  AND ticket_id = '<ticket-id>'::uuid
  AND (
    created_at > '<cursor-created-at>'::timestamptz
    OR (created_at = '<cursor-created-at>'::timestamptz AND id > '<cursor-id>'::uuid)
  )
ORDER BY created_at ASC, id ASC
LIMIT 51;
```

## Analytics

Daily rollups by tenant/date:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM analytics_daily_rollups
WHERE tenant_id = '<tenant-id>'::uuid
  AND date >= '2026-01-01'::date
  AND date <= '2026-01-30'::date
ORDER BY date ASC;
```

## Capture Guidance

Record:

- SQL query
- full query plan
- row counts
- planning time
- execution time
- whether the expected tenant-scoped index was used

Do not add or change indexes from a single plan. Compare plans across representative tenant sizes and document the endpoint behavior first.
