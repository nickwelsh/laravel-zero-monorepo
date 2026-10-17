# Laravel Zero docs

Versioned v0.x documentation using [docs-base](https://github.com/nickwelsh/docs-base).
The shared package owns the Waku/Fumadocs application and rendering. This directory
owns site configuration, MDX guides, and Refquill-generated API JSON.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm docs:dev
```

Open [localhost:3000/laravel-zero/](http://localhost:3000/laravel-zero/).

```sh
pnpm docs:generate
pnpm --filter @laravel-zero/docs api:validate
pnpm docs:typecheck
pnpm docs:build
pnpm docs:start
```

Production preview: [localhost:8080/laravel-zero/](http://localhost:8080/laravel-zero/).
Build and dev regenerate the API reference automatically. Commit
`generated/api.json` after API source changes; never edit or reformat it manually.
Refquill reads PHP from `packages/laravel/src` and TypeScript from the public core
and React entry points. All paths in `refquill.json` resolve relative to this directory.

Authored guides live under `content/docs/0.x/docs`. Version and section navigation
come from `meta.json`. The generated reference is mounted at
`/laravel-zero/docs/0.x/api`; avoid authored pages under that prefix.

`waku.config.ts` sets the public origin to `https://docs.nickwelsh.me` with
`/laravel-zero` as the base path. Change those hosting values before deployment if
needed. The Waku request-handler patch supplied by docs-base is registered in the
root workspace config. The site uses the root pnpm version and lockfile.

## Cloudflare Workers deployment

The site is deployed as Workers Static Assets by the `Deploy docs` GitHub Actions
workflow after CI succeeds on `main`. It can also be run manually on `main`.
`cloudflare.config.ts` owns the `laravel-zero-docs` Worker and only the
`docs.nickwelsh.me/laravel-zero` and `docs.nickwelsh.me/laravel-zero/*` routes.
The existing proxied DNS record for `docs.nickwelsh.me` must remain in place.

Create the GitHub environment `docs` and set:

| Setting                 | Type               | Value                                  |
| ----------------------- | ------------------ | -------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Environment secret | Cloudflare deployment token            |
| `CLOUDFLARE_ACCOUNT_ID` | Environment secret | Account containing the Worker and zone |

For the first deployment, set the token's Workers **default permissions to Admin**
at the product scope: creating a Worker requires Admin and cannot be granted to a
Worker that does not exist. Also grant **Zone / Workers Routes / Write** and
**Zone / Zone / Read**, scoped to `nickwelsh.me`, so the CLI can resolve the zone
and attach the routes. After creation, Workers access can be narrowed to
**Editor** on `laravel-zero-docs`; retain route permissions while deployment
manages the routes. No DNS editing permission or runtime secrets are needed.
See [Cloudflare Workers roles](https://developers.cloudflare.com/workers/authorization/workers/).

To validate locally without credentials:

```sh
pnpm docs:build
pnpm --filter @laravel-zero/docs deploy:check
pnpm --filter @laravel-zero/docs exec vite preview
```

The separate Vite build packages Waku's `dist/public` into Cloudflare Build Output
without rebuilding the application. `cf deploy --prebuilt --mode production`
deploys those exact assets. `cf build` detects Waku and runs its framework build,
which does not produce this static Cloudflare package, so use `deploy:check`.

After setting the credentials locally, deploy the checked build with:

```sh
pnpm --filter @laravel-zero/docs run deploy
```
