# Formbraid development fixtures

The npm staging packages are placeholders without usable package contents.
These development-only archives build Formbraid's core and React runtime from
[`6dce7fcdf410394f73133f22850b9bf86c0462b0`](https://github.com/nickwelsh/formbraid/commit/6dce7fcdf410394f73133f22850b9bf86c0462b0).
They retain the upstream MIT license. No Formbraid runtime is bundled into the
Zero client; its public types use type-only imports from `@formbraid/core`.

Rebuild with `node scripts/vendor-formbraid.mjs`, or pass a checkout at that
revision as the first argument. This needs Git/network access, installed root
development dependencies, TypeScript, and npm. The script emits JavaScript and
declarations from the runtime entry points and removes generator-only metadata.
Workspace overrides resolve React's core dependency to the matching fixture.

Replace these archives with published dependencies once Formbraid releases this
descriptor contract. Consumers should use a matching source build until then.
