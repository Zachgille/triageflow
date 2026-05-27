# ADR 0003: Redis Workers

## Context

TriageFlow needs asynchronous processing for SLA checks, SLA breach detection, notifications, and analytics rollups. These jobs must support retries, scheduling, and controlled concurrency.

## Decision

Use Redis with BullMQ for background work. The API enqueues jobs, and a separate worker process consumes them.

Workers must be idempotent. Duplicate delivery, retries, and partial failures must not create duplicate breach records, duplicate notifications, or incorrect analytics.

## Alternatives Considered

- In-process timers in the API: simple, but unreliable across restarts and multiple API instances.
- Database polling only: avoids Redis, but increases database load and requires more custom scheduling logic.
- External managed queue: useful later, but less aligned with the local Docker Compose development target.

## Consequences

Redis and BullMQ provide mature queue semantics and local reproducibility. The system must define job payloads carefully, set retry policies, and use unique constraints for idempotent side effects.
