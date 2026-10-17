# @nickwelsh/zero-for-laravel

Typed model queries, automatic optimistic CRUD, and React bindings for Zero for Laravel.
Requires the matching `nickwelsh/zero-for-laravel` Composer package and
`@rocicorp/zero` **1.10.0**. React 18/19 is an optional peer dependency.

Install the current stable release, **v0.1.0**, in your Laravel application:

```sh
composer require nickwelsh/zero-for-laravel
pnpm add @nickwelsh/zero-for-laravel
pnpm add --save-exact @rocicorp/zero@1.10.0
php artisan vendor:publish --tag=zero-config
```

Keep the Composer and JavaScript packages on matching release versions, and use
Zero cache **1.10.0** with the pinned Zero client.

```ts
import { Task } from './zero/generated';
import { useData, useMutation } from '@nickwelsh/zero-for-laravel/react';

const data = useData(Task.query().all());
const create = useMutation(Task.create());
create({ title: 'Hello' });
```

Use these hooks inside Zero's `ZeroProvider`. The root export is framework
independent; `/react` adds React hooks, filter controls, and the native provider.
Laravel generates the schema and allowed operations from your model definitions.

See the [installation guide and API examples](https://github.com/nickwelsh/zero-for-laravel-monorepo#readme)
for model attributes, policies, publication setup, authenticated endpoints,
client lifetime, and supported constraints.
