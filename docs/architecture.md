# Architecture

The Composer package lives in `packages/laravel`. The npm package is
`packages/client`, with independent core and React exports. Both target Zero
1.10.0. No custom queries, custom mutations, Inertia integration, upsert, or
mutable Eloquent-style frontend models are included. Reads hydrate independent
readonly model snapshots; Zero retains ownership of the underlying row store.

## Invariants

- One resolved model description drives generated contracts, server queries,
  mutation inputs, and PostgreSQL publication columns.
- Reads are explicitly public or constrained by definition authorization/server scopes.
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
- Callback filters compile portable predicate templates using a symbolic input;
  request-dependent PHP runs in server scopes, never in generated client code.
- Bound mutation IDs cannot be overridden. Update forms submit only changed fields.
- React adapts Zero's native bindings. Query completeness, errors, and connection
  state remain separate; results never carry over across query or identity changes.

## Proof

Behavior tests precede each implementation slice. Protocol and query tests use
the pinned upstream package, including PHP/TypeScript AST comparison. PostgreSQL
integration tests cover ordered processing, rollback, durable rejections, and publication
changes. React tests cover states, pagination reset, controls, and mutation outcomes.
