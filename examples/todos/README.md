# Shared todos

A Laravel 13 React starter application with session authentication and native Zero
live queries/optimistic CRUD. It consumes the local Composer package in
`../../packages/laravel` and the `@laravel-zero/client` pnpm workspace package.

- Application: <https://todos.test>
- Zero cache: <https://zero.todos.test> (local port 4858)
- Owners create, rename, delete, and share lists with registered users.
- Every member can add, edit, complete, and delete todos.
- Private lists and todos are hidden from other users. User/auth tables are never
  published to Zero. Sharing uses a normal authenticated Laravel endpoint.

## Requirements

Use Herd, PHP 8.4+, Node 24+, pnpm 11, and PostgreSQL 15+ with logical replication
(`wal_level=logical`) and replication privileges for the local database user.
The example uses Pest 5; the library itself supports PHP 8.3 with Laravel 12.

## Install

From the repository root:

```sh
composer --working-dir=packages/laravel install
composer --working-dir=examples/todos install
pnpm install --frozen-lockfile
pnpm build
cd examples/todos
cp .env.example .env
php artisan key:generate
```

Create an empty PostgreSQL database named `laravel-zero-todos`. The included
environment template uses:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=laravel-zero-todos
DB_USERNAME=root
DB_PASSWORD=
```

Generate a private cache key, then put its output in `ZERO_API_KEY` in `.env`:

```sh
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

Keep this key server-side. The template sets `APP_URL=https://todos.test`,
`SESSION_DOMAIN=.todos.test`, secure session cookies,
`VITE_ZERO_CACHE_URL=https://zero.todos.test`, and `ZERO_APP_ID=todos`.

From `examples/todos`:

```sh
herd link todos
herd secure todos
herd proxy zero.todos http://127.0.0.1:4858 --secure
php artisan migrate
php artisan zero:generate
php artisan zero:sync-publication
pnpm build
pnpm zero:dev
```

Leave the last command running. Herd serves Laravel; no `artisan serve` is needed.
For frontend development, run `pnpm dev` in another terminal. After changing model
contracts, regenerate and rebuild; after changing replicated columns, sync the
publication too.

The cache script trusts Herd's local CA with `NODE_EXTRA_CA_CERTS`. Override
`ZERO_HERD_CA` if your CA lives elsewhere. It never disables TLS verification.
The upstream, CVR, and change databases use the same local PostgreSQL database,
with separate internal Zero schemas keyed by `todos`; `ZERO_UPSTREAM_SCHEMA=todos_0`
matches the cache. The replica is stored in ignored `storage/app/zero`.
The dedicated `laravel_zero_todos` publication contains only the domain tables.

## Demo accounts

Optional, in the local environment:

```sh
php artisan db:seed --class=TodosDemoSeeder
```

Sign in as `alice@example.com` or `bob@example.com` with password
`todos-demo-password`. Alice owns Household (shared with Bob) and Personal
(private). These are fictional local accounts. The idempotent seeder does not
reset existing passwords and refuses non-local environments.
You can also register accounts through the starter kit.

## Authorization

A list has one owner and explicit memberships, including its owner. List queries
use `ZeroAuthorizeRelation('memberships')`; memberships are visible only to their
user. Todo queries use `ZeroAuthorizeRelation('list')`. Policies enforce writes,
and FormRequests validate destination-list access, preventing a member from moving
a todo into someone else's private list. Deleting a list cascades its todos and
memberships. Sharing adds membership by registered email; duplicate shares are safe.

List creation inserts its owner membership on the server. The new list becomes
visible once that membership replicates; the example waits for server completion
before selecting it. Membership mutations and custom Zero queries/mutations are
not exposed. Revocation/invitations and richer sharing management are outside this
initial example.

## Checks

From `examples/todos`:

```sh
php artisan test --compact
php vendor/bin/phpstan analyse --no-progress
php vendor/bin/pint --test
pnpm check
pnpm types:check
pnpm build
php artisan zero:generate --check
```

Tests use in-memory SQLite, never the local application database. PHP tests cover
shared CRUD, owner-only list deletion/sharing, outsiders, validation, destination
access, duplicate shares, cascade deletion, and generated query authorization.
Frontend lint/format rules belong to the root Vite+ config. Generated Zero and
Wayfinder code and build outputs are excluded from formatters/lint, with generated
contracts checked separately. No new lint rules are disabled for this example.
