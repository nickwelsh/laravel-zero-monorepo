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

`useMutation` also returns a Formbraid descriptor. Pass it to your application's
registered `Form`; selected relations add prefixed fields and share one mutation:

```tsx
const { form } = useMutation(Party.create().with('person'));
return <Form form={form} />;
```

Formbraid owns edits and submission. The callback restores date strings to Dates,
waits for server acceptance, and maps field errors. The client has a
type-only `@formbraid/core` peer required by its public TypeScript declarations;
use Formbraid's current source descriptor
contract until that version is published. Collections require an application
array component; see the mutations guide for component names and defaults.

See the [installation guide and API examples](https://github.com/nickwelsh/zero-for-laravel-monorepo#readme)
for model attributes, policies, publication setup, authenticated endpoints,
client lifetime, and supported constraints.
