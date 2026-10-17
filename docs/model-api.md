# Model contracts and React

Model attributes opt into `all`/`one` and mutation operations. One static
`zero(): ZeroDefinition` owns the public query contract, read constraints,
context-filled fields, and operation FormRequests. Legacy visibility/fill
attributes remain compatible; new code can keep these declarations in the definition.

## Read visibility and trusted context

```php
return ZeroDefinition::make()
    ->authorize('user_id', '=', ContextField::UserId)
    ->fillFromContext('user_id', ContextField::UserId)
    ->allowedFilters('title', AllowedFilter::exact('id'))
    ->allowedIncludes('list')
    ->allowedSorts('title', 'created_at');
```

Use `publicReads()` for explicitly public models, or `authorizeRelation('list')`
to require a related row visible under that model's own definition. These
constraints are generated for local queries and independently enforced by Laravel.
Context fills apply on create, are resolved separately on client/server, and are
excluded from caller-writable fields. Custom context keys can use string references.
The server context resolver must derive their values from authenticated state.

For runtime PHP, use a mandatory server scope:

```php
->enforceServerScope(
    function (ZQLBuilder $query, ZeroContext $context): void {
        $query->whereExists('list', fn (ZQLBuilder $list) => $list->where(
            fn (ZeroOperator $op) => $op->or(
                $op->cmp('user_id', $context->get('user_id')),
                $op->exists('shares', fn (ZQLBuilder $share) =>
                    $share->where('user_id', $context->get('user_id'))),
            ),
        ));
    },
    relations: ['list'],
)
```

Register `shares` on the list definition with `->relations('shares')` or through
its own scope's `relations` argument. This declares schema dependencies without allowing client
includes. Every related target must be registered and define its own visibility.
Scopes also apply to included rows and relationship predicates. Conditions within
a scope can use OR; the mandatory scope as a whole is ANDed with user filters.
An empty scope is an error. Missing required context denies access.

Callbacks execute with fresh trusted context during server query compilation,
never during generation. Their PHP source is not exported. Zero permits server
queries to add permission constraints absent from the local implementation.
Local queries can still match other already-synced authorized rows, so mirror
predicates with `authorize`/`authorizeRelation` when exact local behavior matters.

## Query-builder filters

`allowedFilters`, `allowedIncludes`, and `allowedSorts` accept variadic arguments
or one array. Disallowed arguments remain errors on both client and server.

```php
->allowedFilters(
    'title', // Escaped, case-insensitive substring.
    AllowedFilter::exact('id'),
    AllowedFilter::beginsWithStrict('prefix', 'title'),
    AllowedFilter::endsWithStrict('suffix', 'title'),
    AllowedFilter::operator('completed_after', FilterOperator::GREATER_THAN, 'completed_at'),
    AllowedFilter::operator('completed_at', FilterOperator::DYNAMIC),
    AllowedFilter::groupOr('search', [
        AllowedFilter::partial('title'),
        AllowedFilter::exact('id'),
    ]),
    AllowedFilter::callback('is_completed', fn (ZQLBuilder $query) =>
        $query->where('completed_at', 'IS NOT', null)),
)
```

Import `LaravelZero\Enums\FilterOperator` and the builders from `LaravelZero\Query`.
Scalar groups use one value across their members; use compatible column types.
`groupAnd` is also available. Unlike URL query strings, dynamic operators retain
the actual input type, including `Date`:

```ts
Task.query.all().filter({
    model: 'Task',
    name: 'completed_at',
    value: { operator: '>=', value: new Date('2026-01-01T00:00:00Z') },
});
```

Portable callback filters build a fixed predicate template during metadata
construction. An optional second callback argument represents its symbolic input:

```php
AllowedFilter::callback('title_is', fn (ZQLBuilder $query, mixed $value) =>
    $query->where('title', $value), 'title')
```

The last argument names the column defining the input type; without it, the input
is boolean. A requested callback applies its predicate, including when its value
is false. Use the input in builder comparisons; do not branch on it or call PHP
string/date functions on it. Runtime PHP/context belongs in `enforceServerScope`.
Callback relationship predicates, arbitrary Eloquent SQL/scopes, custom SQL sorts,
and Spatie's URL coercions are not supported. This API follows Spatie's naming
where ZQL supports the behavior; it is not an Eloquent builder replacement.

## Records, casts, and optional DTO types

```tsx
const tasks = useData(Task.query.all().with('list'));
const task = tasks.data[0];
// task.data.title
// task.data.list?.data.name
// useData(task.list) in a component receiving a defined task
```

Columns never collide with instance mutation methods. Included relations are
recursively hydrated snapshots. Lazy relations run through the parent's authorized
`one` query. They do not bypass visibility by querying a target table directly.

All supported database dates/timestamps, including implicit lifecycle fields,
become `Date`. Backed enum casts become backing-value literal unions. Boolean,
integer, float, string, array/JSON, and object casts hydrate their public values;
mutation preparation converts them back to native storage values. PHP DTO methods,
encrypted casts, and arbitrary custom cast transformations do not run in JavaScript.
JSON remains generic when no shape is declared.

A project can reuse a generated Laravel Data type or any handwritten DTO shape
through TypeScript's native module augmentation:

```ts
import type { PreferencesData } from './types';

declare module '@laravel-zero/client' {
    interface ModelTypes {
        Task: { preferences: PreferencesData };
    }
}
```

The mapping refines rows and mutation inputs. It supplies static JSON typing,
not a runtime DTO constructor or validator. Authoritative nested validation still
belongs in Laravel. This does not require Laravel Data or TypeScript Transformer.

## Bound mutation forms and field permissions

```tsx
const { form, submit, defaultValues, state } = useMutation(task.update());

return (
    <form onSubmit={submit}>
        <input value={form.values.title ?? ''} onChange={(event) => form.setValue('title', event.target.value)} />
        <button disabled={state.status === 'pending'}>Save</button>
    </form>
);
```

The form exposes values, field errors, and column/writable-field metadata. It does
not prescribe a component library. Bound updates start with writable defaults
and submit edited fields plus any fields explicitly required by the update rules. `useMutation(task.destroy()).submit()` needs no ID.
The callable API remains available (`update({ title: 'Changed' })`), as do static
operations with explicit IDs. Bound IDs cannot be overridden. Reset restores defaults;
switching record or Zero identity clears form state and ignores old mutation outcomes.

Policies decide whether a user may perform an operation on the original record.
An update FormRequest can then restrict which fields they may submit:

```php
public function authorize(): bool
{
    $task = $this->route('model');
    $user = $this->user();
    if (! $task instanceof Task || $user === null) {
        return false;
    }
    $allowed = $task->user_id === $user->getAuthIdentifier()
        ? ['title', 'completed_at']
        : ['completed_at'];

    return array_diff(array_keys($this->except('id')), $allowed) === [];
}
```

The policy must separately deny users without task access. A patch containing
any forbidden field is rejected as a whole. Keep `rules()` extractable without
runtime request data; request-specific permissions belong in `authorize()`.
Normalization hooks are trusted server code: they must preserve these field
restrictions if they introduce additional values after authorization.
