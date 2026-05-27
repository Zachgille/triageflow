# ADR 0002: Modular Monolith

## Context

TriageFlow needs clear domain boundaries without the operational overhead of distributed services. Early development will benefit from shared transactions, simpler deployments, and easier refactoring.

## Decision

Build the backend as a modular monolith with a separate worker process. Modules should align with business capabilities, but remain in one codebase and one primary database.

The worker process is separate for queue processing and scheduling, not because it owns an independent service boundary.

## Alternatives Considered

- Microservices: provides independent deployment boundaries, but introduces distributed transactions, network failure modes, and operational complexity before they are justified.
- Single unstructured application: fastest initially, but weakens domain boundaries and makes authorization and tenancy harder to reason about.

## Consequences

The modular monolith gives strong consistency and simpler delivery. Module boundaries must still be respected in code. If future scale requires service extraction, modules with clean boundaries will be easier to extract.
