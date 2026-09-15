# Signal Pack Documentation

This directory separates durable product specifications from the documents that govern implementation work.

## Specifications

| Document | Source of truth for |
|---|---|
| [00 Product overview](specs/00-product-overview.md) | Product scope, user, policies, success criteria, and demo constraints. |
| [01 UI specification](specs/01-ui-spec.md) | Screens, interaction requirements, visual system, and accessibility. |
| [02 Architecture](specs/02-architecture.md) | System boundaries, execution model, security design, and integration choices. |
| [03 Research harness](specs/03-research-harness.md) | Tool limits, evidence rules, model behavior, and deterministic validation. |
| [04 API contracts](specs/04-api-contracts.md) | HTTP and SSE request, response, and event schemas. |
| [05 Data and retention](specs/05-data-and-retention.md) | Authoritative Postgres schema, ownership, deletion, and fixture data. |
| [06 Deployment](specs/06-deployment.md) | Environments, operations, limits, and release checks. |
| [07 Build plan](specs/07-build-plan.md) | Build units, dependencies, and definitions of done. |

## Execution

| Document | Purpose |
|---|---|
| [Coding standards](coding-standards.md) | Rules for writing and reviewing production code. |
| [Progress tracker](progress-tracker.md) | Live record of completed work, blockers, and spec deviations. |

`specs/` describes the intended product. `progress-tracker.md` describes what is actually implemented. Update both only when a deliberate decision or implementation result changes the relevant truth.
