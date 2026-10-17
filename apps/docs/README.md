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
