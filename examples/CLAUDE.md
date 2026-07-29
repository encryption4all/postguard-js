# CLAUDE.md

## Agent notes (migrated from the dobby memory repo)

## Overview
Example applications demonstrating PostGuard integration. Nothing here is published or deployed; these are the snippets docs.postguard.eu teaches from.

Imported from `encryption4all/postguard-examples` (archived) as part of the monorepo consolidation. They are pnpm workspace members now, not standalone npm projects — `npm ci` in a sub-directory is no longer how any of this is built.

## Sub-projects
Which SDK each one consumes is the thing to keep straight, because only two of the four can be held to the workspace copy:

| Sub-project | SDK | Source |
| --- | --- | --- |
| `pg-node/` | `@e4a/pg-js` | **`workspace:*`** — `packages/pg-js` |
| `pg-sveltekit/` | `@e4a/pg-js` | **`workspace:*`** — `packages/pg-js` |
| `pg-manual/` | `@e4a/pg-wasm` | published; it is a *dependency of* `packages/pg-js`, not a workspace package |
| `pg-dotnet/` | `E4A.PostGuard` | published to NuGet from `encryption4all/postguard-dotnet` |

- `pg-sveltekit/`: SvelteKit + Vite + TypeScript + eslint.
- `pg-node/`: Node.js 22+ CLI using the SDK from a server runtime. Two modes: `pnpm send` (encrypt + upload + notify) and `pnpm upload` (silent).
- `pg-dotnet/`: .NET example, targets net8.0 and net10.0. **Not a pnpm workspace member** — it has no `package.json`, so pnpm ignores it and `examples.yml`'s `dotnet` job builds it.
- `pg-manual/`: Webpack 5 + plain JS against the low-level WASM SDK.

The first two are the reason the import was worth doing: they pinned a published `@e4a/pg-js ^1.10.0` while the workspace was on 2.x, so the documented snippets could describe a dead API. On `workspace:*` an SDK change that breaks them fails in the PR that makes it. **The other two cannot get that guarantee from this repo** and still depend on the weekly SDK canary; do not describe the import as having closed the drift class for all four.

## CI / tests
There is no unit-test suite (example/reference code only), so `pnpm -r test` legitimately skips every example. That is the one aggregate script they do not participate in — deliberately, rather than via a stub `test` script that would report success without checking anything. Code snippets in docs.postguard.eu are sourced from here; see postguard-docs' CLAUDE.md for the source-link conventions and the consolidation-commit gotcha.

`.github/workflows/examples.yml` (at the repo root, not here) builds them. It is **not** path-filtered: an SDK change has to be tested against its consumers in the same PR, which is the entire point of the import.

`typecheck` is the load-bearing script. `pnpm --filter <pattern> run <script>` **skips a package that lacks the script, silently and with exit 0** — that is how the website and the Outlook add-in both shipped without a typecheck. So `examples.yml` asserts every `examples/*/package.json` declares `typecheck` before running it, and asserts every example depending on `@e4a/pg-js` does so as `workspace:*`. Both guards also fail when they match nothing, so an empty glob cannot report success. If you add an example, give it a real `typecheck` or CI will tell you.

`build` and `lint` are best-effort by comparison: `pg-node` has nothing to build, and only `pg-sveltekit` has a `lint`. That asymmetry is fine *because* `typecheck` is asserted.

The `dobby-coder` GitHub App has no `workflows` permission, so any push touching `.github/workflows/` is rejected with "refusing to allow a GitHub App to create or update workflow". Agents must deliver workflow changes as a patch for a human to apply.

Per sub-project, from the repo root:

| Sub-project | Install | Then |
| --- | --- | --- |
| `pg-manual` | `pnpm install` (whole workspace) | `pnpm --filter @e4a/pg-example build` and `… typecheck` |
| `pg-node` | `pnpm install` | `pnpm --filter pg-node typecheck` (no build) |
| `pg-sveltekit` | `pnpm install` | `pnpm --filter pg-sveltekit build`, `… typecheck`, `… lint` |
| `pg-dotnet` | `dotnet restore --locked-mode` in `examples/pg-dotnet` | `dotnet build --no-restore` |

Each example's `typecheck` is an alias for its own `check`, so there is one definition per project rather than two that can drift.

- `pg-node` has no bundler, so `check` is its build equivalent: a `node --check` syntax pass over `index.mjs`, plus an ESM import of `src/encryption.mjs`. The import is the part that matters: it resolves `src/`'s named imports against the workspace `@e4a/pg-js`, so a renamed or removed SDK export fails it. Two things it does not cover. `index.mjs`'s own imports are never linked, because importing `index.mjs` would run the CLI, so renaming an export in `src/config.mjs` still passes and only fails at `node index.mjs`. And it says nothing about signature changes behind an unchanged export name.
- `pg-manual`'s `build` script carries `--fail-on-warnings`. Webpack reports a missing *named* export on a static import as a warning and still exits 0, which is how the `web-streams-polyfill` rename recorded under "pg-manual build notes" below could have shipped green; the flag turns that class into a failed build. It does not catch the yivi breakage recorded there: `import * as Foo` is valid ESM whatever the module exports, so webpack compiles it with zero warnings and the failure is a runtime `TypeError: ... is not a constructor` at `new YiviCore(...)` in `examples/utils.js`. No build gate covers that class, and `check/sdk-exports.js` can't close it either, because the mistake is in this repo's own import form rather than in the SDK's export list; only running the example would catch it. The tree compiles with zero warnings today, so keep the flag rather than dropping it.
- `pg-manual`'s `check` is a second, tiny webpack build (`check/webpack.config.js`), also run with `--fail-on-warnings`. It covers the half the flag on `build` cannot reach: the examples get `@e4a/pg-wasm` through a *dynamic* `import()` and destructure at runtime, and webpack analyses no exports across that boundary, so dropping `seal` from the SDK leaves `build` at exit 0 with zero warnings. `check/sdk-exports.js` imports the same names statically, which puts them back under the analysis. Adding a name means editing both the import and the object literal under it, because an unreferenced import is elided and probes nothing.
- `pg-dotnet` restores with a lockfile (`packages.lock.json`, enabled by `RestorePackagesWithLockFile`). After changing any `PackageReference`, run `dotnet restore` and commit the regenerated `packages.lock.json` in the same commit, otherwise `--locked-mode` fails with `NU1004: the package reference ... has changed`.

## Known issues / intentional non-fixes
- `pg-manual/webpack.config.js` hardcodes `mode: 'development'` intentionally. This is an example app and does not need a production build; don't refile or propose a fix for the dev-only webpack mode.
- `pg-node`'s `send` (and `start`) npm script passes no flag, so `index.mjs` defaults to send-email mode; only `upload` passes `--upload-only`. There is no `--send` flag.
- Each sub-project has its own `.gitignore` (`pg-manual`'s was added later); `examples/.gitignore` only covers `*.sln` and `.DS_Store`. When adding files to a subdir, stage explicit paths rather than `git add -A` if you're not sure a `.gitignore` exists there.

## pg-sveltekit build notes
- vite 8 + `@sveltejs/vite-plugin-svelte` 7 works once `vite-plugin-top-level-await` is dropped entirely: vite 8/rolldown passes top-level await through unchanged for modern browsers (Chrome 89+, Firefox 89+, Safari 15+), which is what `vite-plugin-wasm`'s WASM init relies on. Don't reintroduce `vite-plugin-top-level-await` unless pre-Chrome-89 support becomes a requirement, it still `require()`s rollup, which vite 8 no longer bundles, recreating the coupling that blocked the vite 8 upgrade in the first place.
- `vite.config.ts`'s `build.target` must stay pinned to `esnext`. vite 8/rolldown's default target would otherwise transform top-level await for older browsers, defeating `vite-plugin-wasm`.
- Build verification, from the repo root: `pnpm install && pnpm --filter pg-sveltekit build && pnpm --filter pg-sveltekit typecheck` should be 0 errors / 0 warnings.
- **The `overrides.cookie: ^0.7.2` block is gone, and must not come back here.** pnpm ignores an `overrides` block in a workspace member outright, so keeping it would have read as protection that was not applied — the exact way `cookie` and `esbuild` silently regressed during the website import. The advisory it existed for (GHSA-pxg6-pf52-xh8x, via `cookie <- @sveltejs/kit <- @sveltejs/adapter-auto`) is covered by the root `pnpm-workspace.yaml`, which carries a scoped `'@sveltejs/kit>cookie': '>=1.1.1'`. Verified across the import: `pnpm audit --prod` was clean before and after, and the dev advisory set was byte-identical. Any new override goes in the root file, scoped, and expressed as a floor rather than a range.
- Staging Cryptify detection: both `pg-dotnet` and `pg-sveltekit` detect "this is staging Cryptify" by checking whether the configured Cryptify URL hostname contains the substring `staging` (case-insensitive), because staging Cryptify doesn't send notification emails and exposes no API/header signal for that. `pg-dotnet/Program.cs` uses `Uri.TryCreate` + `Host.Contains("staging", OrdinalIgnoreCase)`; `pg-sveltekit/src/lib/config.ts` exports `IS_CRYPTIFY_STAGING` the same way. If Cryptify ever exposes a real capability/header for this, swap the heuristic for the real signal, it's a workaround, not a desired pattern. The printed download URL follows the same heuristic (`staging.postguard.eu` on staging, `postguard.eu` otherwise), because files uploaded to staging Cryptify are only retrievable via the staging website; override it with `PG_DOWNLOAD_URL` (`pg-dotnet`) or `PUBLIC_DOWNLOAD_URL` (`pg-sveltekit`) if your deployment differs.

## pg-manual build notes
- `web-streams-polyfill` v4 renamed its `PolyfilledWritableStream` export to `WritableStream`. Webpack only warns on the missing v3 export ("export ... was not found"), it doesn't fail the build, so it's easy to ship a broken example silently. When grepping for known-breaking dependency changes, always re-read webpack's build output for "was not found" warnings. Fix: `import { WritableStream as PolyfilledWritableStream } from 'web-streams-polyfill'`.
- `@privacybydesign/yivi-{core,client,popup}` 0.2 to 1.x changed module shape: v0.2 was CJS (`module.exports = class Foo`) and worked under `import * as Foo from '...'` via webpack's CJS interop; v1.0 ships proper ESM with named exports, so `import * as` no longer gives a callable constructor. Switch to `import { YiviCore } from '@privacybydesign/yivi-core'` (same for `YiviClient`/`YiviPopup`); `yivi-css` stays a bare side-effect import. The `yivi.use(...)` plugin contract is unchanged, expect the named-import migration to be the only code change on future yivi majors.
- Bumping `webpack-dev-server` does NOT auto-refresh its already-locked transitive `ws` / `http-proxy-middleware` / `launch-editor` versions, even when the new wds's declared ranges already permit the CVE-fixed versions. After bumping it, run `pnpm update ws http-proxy-middleware launch-editor --filter @e4a/pg-example` to pull the fixed versions in-range, then re-check `pnpm audit`. No override is needed for these three.
- **The `overrides.uuid: ^11.1.1` block is gone too**, for the same reason: inert in a workspace member. Removing it changed nothing measurable — GHSA-w5hq-g745-h8pq (via `uuid <- sockjs <- webpack-dev-server`) was already present in the workspace's dev tree before the import and is unchanged after it, and `pnpm audit --prod` stays clean because none of it is reachable from shipped code. The constraint is still worth knowing if it is ever pinned from the root: use 11.1.1, not 12+, because uuid 12 is ESM-only (`type: module`) while sockjs `require()`s it. Tracked with the other dev-tooling advisories in encryption4all/postguard-js#142.
- Build verification, from the repo root: `pnpm install && pnpm --filter @e4a/pg-example build && pnpm --filter @e4a/pg-example typecheck` must be a clean compile with zero "export ... was not found" warnings.
- **`resolve.modules` must stay absent from `webpack.config.js`.** It used to be `[path.resolve(__dirname, 'node_modules')]`, which restricted resolution to that one directory and worked only because npm's flat layout hoisted every transitive dependency into it. Under pnpm each package gets its own scope, so `@privacybydesign/yivi-client` resolves `deepmerge` from `.pnpm/…/yivi-client/node_modules` — a path an absolute `modules` entry excludes. That failed the import with three `Module not found` errors (`deepmerge` twice, `@privacybydesign/yivi-web` once) even though all three are correctly declared by the yivi packages. webpack's default walks up from each module's own directory, which is what pnpm needs; do not reintroduce the override.
