# Architecture

The Composer package lives at the repository root. The npm package is
`packages/client`, with independent core and React exports. Both target Zero
1.10.0. No custom queries, custom mutations, Inertia integration, upsert, or
hydrated mutable models are included in this first version.

## Invariants

- One resolved model description drives generated contracts, server queries,
  mutation inputs, and PostgreSQL publication columns.
- Reads are explicitly public or constrained by declarative authorization.
  Related rows and relationship filters retain the target's authorization.
- `$hidden` and Zero exclusions are additive. Required excluded keys are an
  error, never silently published.
- Query arguments are validated and rebuilt into trusted ASTs. Client ASTs and
  client-supplied context never establish server authority.
- Zero owns replication, subscriptions, optimistic writes, and reconciliation.
- Public dates are `Date`; Zero rows and JSON mutation arguments use epoch
  milliseconds. Defaults are generated before enqueueing, once per operation.
- CRUD is opt-in, policy-protected per operation, and executed through Eloquent.
  Server-owned fields and lifecycle timestamps cannot be patched by callers.
- Application writes, ordered progress, and durable rejection results commit
  atomically. Duplicates do not execute again. Database failures remain retryable.
- Mutation bookkeeping uses Zero's shard-owned upstream schema and table
  shapes. Applications never create a competing replication bookkeeping table.
- React adapts Zero's native bindings. Query completeness, errors, and connection
  state remain separate; results never carry over across query or identity changes.

## Proof

Behavior tests precede each implementation slice. Protocol and query tests use
the pinned upstream package, including PHP/TypeScript AST comparison. PostgreSQL
integration tests cover ordered processing, rollback, durable rejections, and publication
changes. React tests cover states, pagination reset, controls, and mutation outcomes.
