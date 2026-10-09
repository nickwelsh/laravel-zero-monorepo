# @laravel-zero/client

Typed model queries, automatic optimistic CRUD, and React bindings for Laravel Zero.
Requires the matching `nickwelsh/laravel-zero` Composer package and
`@rocicorp/zero` **1.10.0**. React 18/19 is an optional peer dependency.

```ts
import { Task } from "./zero/generated";
import { useData, useMutation } from "@laravel-zero/client/react";

const data = useData(Task.query().all());
const create = useMutation(Task.create());
create({ title: "Hello" });
```

Use these hooks inside Zero's `ZeroProvider`. The root export is framework
independent; `/react` adds React hooks, filter controls, and the native provider.
Laravel generates the schema and allowed operations from your model definitions.

See the [installation guide and API examples](https://github.com/nickwelsh/laravel-zero#readme)
for model attributes, policies, publication setup, authenticated endpoints,
client lifetime, and supported constraints.
