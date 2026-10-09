# Workspace tooling

The repository root owns workspace tooling and cross-language contract tests.
`packages/laravel` owns the `nickwelsh/laravel-zero` Composer package, its source,
configuration, tests and PHP tools. `packages/client` owns the
`@laravel-zero/client` npm package and its core and React exports.

Use PHP 8.3+, Composer, Node 22.18+ (22.x) or 24.11+, and the pinned pnpm version. The
Composer platform is pinned to PHP 8.3 so development dependencies remain usable
on the minimum supported runtime. Laravel 12 and 13 are tested in CI.

```sh
composer --working-dir=packages/laravel install
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` checks formatting, lint, PHPStan, Rector, spelling, TypeScript, Pest,
frontend tests, generated-contract drift, the build, and package export isolation.
Set `ZERO_TEST_PG_DATABASE=laravel_zero_test` to include PostgreSQL tests. The
database must be empty and disposable. CI always supplies it. Do not run two PHP
test suites against the same database concurrently.

| Command                        | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `pnpm format` / `format:check` | Oxfmt for workspace files and Pint for PHP                       |
| `pnpm lint`                    | Apply frontend fixes and Markdown fixes                          |
| `pnpm lint:check`              | Frontend, Markdown, PHPStan, Rector dry run and Peck             |
| `pnpm typecheck`               | Strict TypeScript checking, including public-contract fixtures   |
| `pnpm test`                    | Vite+ tests, including React and PHP/native Zero AST comparisons |
| `pnpm php:test`                | Pest with Testbench and optional PostgreSQL integration tests    |
| `pnpm php:rector`              | Apply PHP 8.3 / Laravel 12-compatible Rector changes             |
| `pnpm build`                   | Vite+ library packaging with declaration files                   |
| `pnpm contracts:check`         | Verify generated TypeScript matches PHP model metadata           |
| `pnpm package:check`           | Verify built exports and load the core with React blocked        |

Coverage is opt-in locally:

```sh
pnpm test:coverage
XDEBUG_MODE=coverage pnpm php:test:coverage
```

Frontend reports go to `coverage/client`; PHP reports go to
`packages/laravel/coverage`. PHP needs Xdebug or PCOV. Include PostgreSQL when
measuring the full suite. CI saves both reports. There is no artificial 100%
coverage or type-coverage gate; behavior tests and level-6 analysis are required.

## Adaptations from the application configs

- **Vite+ replaces direct Vitest, Prettier and tsup tooling.** `vp pack` builds the
  library; an application bundle, dev server, SSR build and Laravel Vite plugin
  are unnecessary. Export paths and the optional React peer remain unchanged.
- **Application integrations are omitted:** Inertia, Wayfinder, Tailwind,
  auto-imports, icons, application aliases and application dependency prebundling.
  React Compiler transformation and its blanket compiler lint rules are omitted;
  consumers control compilation. Standard hook rules and dependency checks remain.
- **Stylelint and Tailwind sorting are omitted:** there is no CSS or Tailwind
  stylesheet. Browser-compatibility and HTML baseline plugins are omitted until
  supported browser targets are defined; JSX accessibility checks remain enabled.
- **Lint categories:** correctness and suspicious rules are enabled. Blanket
  nursery, pedantic, performance, restriction and style presets are omitted.
  Regex rules, focused-test detection, native-prototype protection, type imports,
  and type-aware checking are enabled explicitly. Automatic JSX runtime disables
  `react-in-jsx-scope`. The official hook plugin replaces duplicate native memo
  dependency diagnostics. Compiler `refs`, `immutability` and `globals` rules are
  disabled only in files containing the existing mutation identity guard, external store
  factories and test harnesses. Unsafe-assertion and redundant-generic-argument
  bans are disabled because generated registry bridges require mapped-type
  assertions. A documented exception preserves the public filter tuple generic.
  Compile-only fixtures permit unused values and expressions; tests
  permit locally scoped harness functions. One documented hook dependency exception
  preserves filter store identity when equivalent names/options are recreated.
- **Generated fixtures** are excluded from formatting and lint transformations;
  `contracts:check` verifies their exact bytes, TypeScript checks their contracts,
  and integration tests execute them. Vendor, build output and lockfile formatting
  are excluded. Markdown keeps the reference's disabled line-length rule.
- **Pint keeps the Laravel preset and extra strict rules**, except automatic
  finalization (`final_class`, `final_internal_class`,
  `final_public_method_for_abstract_class`) and `protected_to_private`, which would
  obstruct package extension, Eloquent fixtures and Testbench overrides.
  `mb_str_functions` is disabled because filesystem offsets and protocol lengths
  intentionally use byte semantics. TestCase is formatted instead of excluded.
- **PHPStan runs at level 6 on source and tests without a baseline.** PHPDoc types
  are not assumed certain, preserving runtime validation for untyped consumers.
  Pest 4 closure bindings are explicitly documented in the tests.
- **Pest 5 PHPStan/Rector plugins are omitted:** their available releases require
  PHP 8.4 and Pest 5. Pest 4 and its bundled PHPStan extension preserve PHP 8.3
  support. Browser/stress testing plugins and application-only Composer hooks are
  unnecessary for this library. Tests run serially because PostgreSQL fixtures own
  a shared disposable schema; the reference's parallel flag is omitted.
- **Rector targets PHP 8.3 and Laravel 12**, rather than PHP 8.5 / Laravel 13.
  Naming, privatization, Carbon and blanket PHPDoc rewrite sets are omitted to
  preserve public APIs, framework overrides and date behavior. Laravel exception
  helper rewrites are omitted to retain explicit guards and type narrowing.
  Three rule exceptions preserve exception codes, property initialization checks,
  and Pint's import/trait formatting; their exact names are in `rector.php`.
- **Peck checks package source.** Pest feature files execute test registration
  when reflected by Peck, so they are covered by Pest, Pint and PHPStan instead.
  The spelling allowlist contains project/protocol terms rather than application
  business names. Vendor and caches are ignored.

The Vite+ core alias uses its wrapper version, so pnpm permits that exact version
for Vitest's Vite peer requirements. Vite+ and its core alias are pinned together.

## Publishing

Neither package is published by these commands or CI. npm packaging uses
`packages/client`; Composer path repositories use `packages/laravel`. Packagist
expects a repository with `composer.json` at its root, so publishing will need a
subtree split or equivalent release repository. That release workflow is deferred.
