# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`@e4a/pg-js` — TypeScript browser+Node SDK for PostGuard. PostGuard performs identity-based encryption (IBE): senders encrypt for *identity attributes* (email, phone, etc.) and recipients prove that identity via [Yivi](https://yivi.app) to decrypt. This SDK wraps the `@e4a/pg-wasm` cryptographic core, the PKG (key-generation service) HTTP API, the Cryptify upload server HTTP API, and the Yivi client widgets, exposing them through a small lazy builder surface.

## Common commands

All commands from the repo root unless noted; root `build`/`test`/`typecheck` are `pnpm -r` wrappers. Watch modes and single-test runs need `cd packages/pg-js` first.

| Task                         | Command              |
|------------------------------|----------------------|
| Install dependencies         | `pnpm install`       |
| Build (ESM + `.d.mts`)       | `pnpm build`         |
| Watch-mode build             | `pnpm dev` (in `packages/pg-js`) |
| Type-check (no emit)         | `pnpm typecheck`     |
| Run all tests once           | `pnpm test`          |
| Watch tests                  | `pnpm test:watch` (in `packages/pg-js`) |
| Run a single test file       | `pnpm exec vitest run tests/api.test.ts` (in `packages/pg-js`) |
| Run a single test by name    | `pnpm exec vitest run -t "name fragment"` (in `packages/pg-js`) |
| Refresh the API report       | `pnpm api:update` (in `packages/pg-js`, after a build) |
| Check prettier plugin resolution | `pnpm check-prettier-plugins` |

### Prebuild generators (important)

`prebuild`, `pretypecheck`, and `pretest` all run two generator scripts:

- `scripts/generate-wasm-base64.mjs` — reads `node_modules/@e4a/pg-wasm/web/index_bg.wasm`, writes `src/util/wasm-binary.ts` (base64 of the WASM) AND `src/util/pg-wasm-shim.js` (a patched copy of pg-wasm's `index.js` with wasm-bindgen's `new URL("index_bg.wasm", import.meta.url)` default-value branch stripped — that branch never fires at runtime but webpack 5 fails on it because no separate WASM file ships in our dist).
- `scripts/generate-yivi-css.mjs` — reads `node_modules/@privacybydesign/yivi-css/dist/yivi.css` and writes `src/yivi/yivi-css-text.ts` as a string constant.

All three generated files are git-ignored. If `pnpm dev` (which does not run prebuild) is used on a fresh clone, the build will fail until the generators run. `pnpm install` covers this (`prepare` runs them); otherwise run `pnpm prebuild` once in `packages/pg-js`, or use `pnpm build` / `pnpm test`.

If `generate-wasm-base64.mjs` errors that the regex no longer matches, wasm-bindgen has changed its output shape — update the regex (or drop the patch entirely if upstream is clean now).

## Architecture

### Lazy builder surface

The public API is intentionally tiny. `PostGuard` (`src/postguard.ts`, extending `PostGuardBase` in `src/postguard-base.ts`) exposes:

- `pg.encrypt(input)` → returns a lazy `Sealed` (`src/sealed.ts`). Nothing executes until `.toBytes()` or `.upload()` is called.
- `pg.open(input)` → returns a lazy `Opened` (`src/opened.ts`). Inspect-before-decrypt pattern; `.inspect()` reads the header without unsealing, and `.decrypt()` reuses the cached unsealer.
- `pg.sign.{apiKey,yivi,session}(...)` and `pg.recipient.{email,emailDomain}(...)` — small factory helpers exposed as readonly fields. The `recipient.*` factories return `RecipientBuilder` (`src/recipients/builder.ts`), which is the fluent shape consumers use to attach extra attribute constraints.
- `pg.email` — `EmailHelpers` (`src/email/index.ts`) for MIME-envelope construction, sized into three tiers (URL fragment / inline attachment / Cryptify upload). See `EnvelopeTier` and `createEnvelope` if you touch the email-addon path.

Two builder modes exist for `encrypt`: `files` (zipped first, then sealed) and `data` (raw bytes/stream, sealed directly — used for MIME envelopes). `Sealed.mode` reports which mode was selected so downstream code (e.g. `createEnvelope`) can choose the right decrypt URL.

### Core modules

- `src/crypto/` — `encrypt.ts` (full encrypt + upload pipeline), `decrypt.ts` (inspect/unseal), `chunker.ts` (streaming chunk transform), `signing.ts` (resolves a `SigningKeys` from any `SignMethod`).
- `src/api/` — `pkg.ts` (PostGuard key-generation server: MPK, USKs, signing sessions) and `cryptify.ts` (chunked upload + download).
- `src/signing/` — strategies the `SigningKeys` resolver dispatches to: `api-key.ts`, `yivi.ts`, `session.ts`.
- `src/util/` — `wasm.ts` (single-shot pg-wasm initializer using the base64-embedded binary), `zip.ts` (Conflux-based streaming ZIP), `retry.ts` (exponential backoff + jitter for Cryptify chunk PUT/GET; see `RetryOptions`), `identity.ts` (extract `FriendlySender` from sealed sender attributes).
- `src/yivi/` — `inject-css.ts` (Shadow-DOM-safe injection of the embedded Yivi CSS), `decrypt-session.ts` (USK retrieval via QR), `yivi-css-text.ts` (generated).

### pg-wasm integration

Treat `loadWasm()` (`src/util/wasm.ts`) as the only entry to the WASM module. It caches after first call. Never import `@e4a/pg-wasm` directly — the generated shim is what we actually bundle, and bypassing it will reintroduce the webpack `new URL(...)` failure.

### Bundling

`tsdown.config.ts`: ESM-only output, type declarations on, splitting + treeshake on, `@transcend-io/conflux` is `neverBundle`'d (the consumer resolves it, keeping the dist tree-shakeable). `target: false` — we ship modern ES; consumers do their own downleveling.

The package is `"type": "module"` and `"sideEffects": false`. Always use `.js` extensions on relative imports in source (TS resolves them as `.ts` but the emitted ESM needs them).

## Tests

Vitest with Node default environment. Browser-only paths (Yivi QR widgets, `triggerBrowserDownload`) are not covered by the unit tests — those need a real browser and live PKG/Cryptify endpoints. `tests/api.test.ts` is the broad integration of the encrypt/upload/open/decrypt flow against mocked PKG/Cryptify; the smaller files (`chunker`, `zip`, `errors`, `decrypt-session`, `recipients`, `exports`, `postguard`) target single units.

**Tests are typechecked, but by a different config than the build.** `tsconfig.json` is the BUILD config — tsdown reads it, and its `rootDir: "src"` makes every file under `tests/` a `TS6059` error rather than a checked file. `pnpm typecheck` therefore runs `tsc --noEmit -p tsconfig.typecheck.json`, which extends it, drops `rootDir`, and covers `src`, `tests` and `scripts`. Add new test directories to that file's `include`, not to `tsconfig.json`.

Two things about it that are easy to get wrong:

- **`types: ["node"]` is load-bearing.** TypeScript 6 no longer pulls every `node_modules/@types` package into the program automatically. Without it, `Buffer`, `process` and every `node:*` import fail with `TS2591` telling you to install `@types/node` — while `@types/node` is installed and sitting right there. It is pinned to the major in `engines` (`>=22`) so a test cannot quietly use an API the floor lacks.
- Anything a test hands to a public API is part of the contract the package claims, so it is checked. Tests were outside `include` until #153 reviewed one that passed a `Buffer` into a slot `ExtractCiphertextOptions` declares as `ArrayBuffer`, with `pnpm typecheck` green the whole time because it never opened the file.

### Envelope compatibility (the fixture corpus is append-only)

`tests/envelope-forward.test.ts` and `tests/envelope-archival.test.ts` implement the
two directions of COMPATIBILITY.md's envelope guarantee, and they are **not**
symmetric — read the `SDK support windows` section there before touching either.
The `Envelope compatibility` job in `integration.yml` runs exactly these two files
plus `pnpm envelope:check`, deliberately un-path-filtered (a path-filtered required
check never reports on PRs that miss the filter, and branch protection then blocks
them forever).

- **`tests/fixtures/envelopes/` is append-only.** Each fixture records bytes some
  sender actually emitted, and the archival guarantee is a promise about exactly
  those bytes — so a failing archival test means the regression is in the reader, not
  in the fixture. `pnpm envelope:check` fails the build on any modification, deletion
  or rename, comparing against the merge base of the base branch and HEAD (so a
  fixture added on `main` afterwards is not blamed on your branch). Add fixtures with
  `pnpm envelope:fixtures` after a `pnpm build`; it skips existing files, and
  `--force` exists only for a deliberate rebuild before the corpus is merged.
- **The forward test derives every expectation from `result.tier`, never from
  `result.attachment` or `result.uploadUuid`.** This looks like it could be
  simplified and cannot: branching on the output under test means a HEAD that
  silently stops emitting the tier-1 attachment takes the tier-3 branch and passes,
  which is the postguard-tb-addon#85 regression the gate exists to catch.
- The forward readers are real published packages, aliased in this package's
  `devDependencies` as `pg-js-reader-v1` / `pg-js-reader-v2` (currently
  `@e4a/pg-js@1.11.0` and `@e4a/pg-js@2.3.4`). A plain `pnpm install` gets them; they
  resolve to registry tarballs, not to the workspace copy. **Nothing checks that they
  are still the latest of their major** — after a `changeset version` the v2 pin needs
  moving by hand, or the gate quietly degrades to "compatible with an ever-older 2.x"
  while still reporting green. Bump it next to `pnpm api:update` when releasing, and
  drop the v1 alias in a commit that says so when 3.0 takes 1.x out of the window.

## Supported runtimes

- **Browser** — full surface, including Yivi.
- **Node 22+ / Bun / Deno** — encrypt + upload + decrypt paths work for `sign.apiKey` and `sign.session`. `sign.yivi(...)` throws a clear `YiviSessionError` upfront (it needs a DOM). `result.download()` is browser-only; `result.blob` / `result.plaintext` are universal. Node 22 is the floor because tsdown (the build tool) requires 22.18+; the SDK runtime itself would otherwise work on Node 20.3+, but we don't test or claim support there.

Two non-obvious gotchas for non-browser callers, both already handled in the SDK:

- `FileList` is browser-only. `src/sealed.ts` typeof-guards the `instanceof FileList` check so Node doesn't throw `ReferenceError`.
- `@transcend-io/conflux/dist/esm/bigint.js` references the browser-only `self` global at module load. Bun and Deno alias `self === globalThis`; Node does not. `src/util/zip.ts:importConfluxWithSelfShim()` sets `globalThis.self = globalThis` only for the duration of the dynamic import and restores the prior state in a `finally` — no permanent global mutation.

There's a manual smoke test at `scripts/smoke.mjs` runnable under any of the four runtimes. Without `PG_API_KEY` it runs static checks; with one it does a real upload to staging Cryptify.

## Releases and CI

- `main` is the release branch. Releases are managed by **changesets** (`.github/workflows/delivery.yml`): a PR that should ship adds a changeset file (`pnpm changeset`); merging to main opens/updates a "Version Packages" PR; merging THAT publishes to npm with provenance. PR titles must still follow Conventional Commits — `.github/workflows/pr-title.yml` enforces this via `action-semantic-pull-request`.
- `.github/workflows/integration.yml` runs `typecheck + build + test + smoke` across Node 22/24, Bun 1.3.14, and Deno 2.8.0 on every PR. Get the Node lanes green locally before pushing.
- Version in `packages/pg-js/package.json` is the REAL published version, maintained by `changeset version` — do not bump it by hand; add a changeset instead.
- **Every prettier plugin a workspace member declares must ALSO be a root `devDependency`.** `changeset version` formats each `CHANGELOG.md` through prettier, resolving the owning package's config but loading its plugins from the *process cwd* — the repo root. A plugin missing there makes changesets throw while writing that changelog, catch it, print the stack, and **still exit 0 with "All files have been updated"**: the version bump lands, the changelog entry silently does not. `apps/website` did this on every release from its import until it was found, because the gap is invisible in normal use — the app's own `pnpm lint` resolves the plugin fine from its own `node_modules`. `pnpm check-prettier-plugins` asserts it, runs in `integration.yml`, and gates `version-packages` ahead of `changeset version`. When it reports a plugin missing, add it to the ROOT `package.json`, not to the app that declares it.

### Workflow guard steps

Several workflows assert an invariant in an inline `run:` block rather than trusting a
comment — `examples.yml`'s "Every example declares typecheck", `sdk-canary.yml`'s
"Every example consuming a published SDK is covered". Two things about editing those:

- `shell: bash` makes Actions run the script as `bash --noprofile --norc -eo pipefail`,
  so `-e` and `pipefail` arrive on the command line and `set +e` is the only way off
  them. A pipeline on the right of an assignment therefore aborts the step at that
  line — `grep -v` exits 1 when it filters everything, which is how one of these
  guards shipped with its own error annotation unreachable. Append `|| true` to every
  such assignment.
- Verify one by extracting its `run:` block out of the YAML and running it under that
  exact shell, in a throwaway tree holding only the files it reads. A hand-written
  replica under plain `bash` does not reproduce the point above.

### Public API surface report

`packages/pg-js/etc/pg-js.api.md` is a committed snapshot of the package's public
type surface, rendered from the rolled-up `dist/index.d.mts`. It exists so a change
to the compatibility contract shows up as a reviewable diff instead of riding along
in a `refactor:` commit.

- `postbuild` runs `node scripts/api-report.mjs --check`, so `pnpm build` fails when
  the report is stale. That includes CI's Build step, on all three runtime lanes.
  Fix it with `pnpm api:update` (in `packages/pg-js`, after a build), read the diff,
  and commit it.
- `pnpm api:gate [--base <ref>]` does the same check, then classifies the report diff
  and fails when the pending changeset is too small: a removal or a changed signature
  needs `major`, a new export needs at least `minor`. It compares against the *merge
  base* of the base ref and HEAD, not the base tip, so an API change that lands on
  `main` afterwards is not blamed on the branch. That needs enough history in the
  clone to find a common ancestor: `fetch-depth: 0` in CI. A `--depth=1` fetch of the
  base branch is not enough, and the script says so rather than guessing.
- `api:gate` runs in CI: the `api-surface` job in `integration.yml` invokes it (with
  `fetch-depth: 0`, which it needs). Run it locally on API-changing PRs anyway — it is
  faster than waiting for the job.
- The classifier (`scripts/lib/api-surface.mjs`, unit-tested by
  `tests/api-surface.test.ts`) is deliberately conservative: only trailing optional
  parameters count as additive, and everything else that changes an existing
  declaration is treated as breaking. When it is wrong, say so on the PR rather than
  loosening it for one case.
- The report drops `private` members and sorts members by name, so internal state and
  reordering never force a version bump. `protected` members stay, since subclasses
  see them.
- Declarations that are reachable but not re-exported (e.g. `PostGuardBase`,
  `EmailHelpers`) are in the report too. They are part of the surface via inheritance
  and property types even though `src/index.ts` never names them.
- The name in the rollup is not a stable identity. When two declarations share a
  name, rolldown suffixes one of them (`EmailAttributes$1`) and which one depends on
  module order, so a new file that reuses an internal type name shuffles names in the
  report without changing anything consumers can see. The classifier matches
  declarations across the two reports by identity instead (the public name for an
  exported declaration, otherwise the route that reaches it), and prints such a
  rename as a `note` line that requires no bump.

---

## Agent notes (migrated from the dobby memory repo)

## Overview
Monorepo, pnpm workspaces, release via changesets. `packages/pg-js` = `@e4a/pg-js`, the published TypeScript SDK; `apps/website` = the PostGuard site (private, versioned by changesets but not published; its docker image is `ghcr.io/encryption4all/postguard-website`). Remaining apps join per encryption4all/postguard-js#123. The package scripts listed below live in `packages/pg-js/package.json` (working-directory rule: line 11); the website's live in `apps/website/package.json` and run via `pnpm --filter postguard-website <script>`.

Security overrides (`cookie`, `esbuild`) live in the ROOT `package.json` under `pnpm.overrides`. pnpm ignores an `overrides` block in a workspace member entirely — that is how both pins silently regressed to vulnerable versions during the website import. Add new pins at the root only.

Husky lives at the repo root (`.husky/`), because `.git` is there; its pre-commit hook runs lint-staged per package. A `prepare: husky` in a workspace member is a silent no-op.

## Build pipeline (gitignored generated sources)
`src/util/wasm-binary.ts`, `src/yivi/yivi-css-text.ts`, and `src/util/version.ts` are gitignored and generated at build time by `scripts/generate-wasm-base64.mjs`, `scripts/generate-yivi-css.mjs`, and `scripts/generate-version.mjs`. Tests transitively import them. `prebuild`, `pretypecheck`, `pretest`, and `pretest:watch` all run all three generators, so a fresh-clone `pnpm test` works; CI runs `typecheck` before `test`.

Org-wide lesson: any repo combining gitignored generated sources with build-time hooks needs the generator wired into every script that imports the generated module, not just `build`. When auditing, run `pnpm test` and `pnpm typecheck` directly from a fresh `pnpm install` to catch a script that was missed.

## Repo layout
- `src/email/envelope.ts`: HTML template for the PostGuard encrypted email; sender pill styles in `buildAttributePills`.
- CI split: `delivery.yml` (release on push to main), `integration.yml` (PR checks: typecheck + build + test + smoke across Node 22/24, Bun, Deno).

## Examples (`examples/*`)
- `examples/pg-dotnet` multi-targets `net8.0;net10.0`, so a bare `dotnet run` fails with "Your project targets multiple frameworks" — every documented invocation needs `-f net10.0`. Building needs the .NET 10 SDK: it ships only its own targeting pack and `dotnet restore` fetches the `net8.0` one (`microsoft.netcore.app.ref`) from NuGet, which a cold cache turns into a network dependency. `--locked-mode` cannot block that fetch, because a targeting pack is not a `PackageReference` and never lands in `packages.lock.json`. Checked on SDK `10.0.100-rc.2`.
- `UploadOptions.notify` is object-only in the types but unvalidated at runtime (`packages/pg-js/tests/postguard.test.ts` pins the old validator's removal). TypeScript callers get `TS2559` on `{ notify: true }`; the plain-JS examples get a silent no-mail upload with the silent-upload notice suppressed, since `notify` is defined. Keep example READMEs explicit that the check is compile-time only.

## Package scripts
- `prebuild` / `pretypecheck` / `pretest` / `pretest:watch`: run all three generators.
- `build`: tsdown.
- `typecheck`: `tsc --noEmit -p tsconfig.typecheck.json` (covers `src`, `tests` and `scripts`; see the Tests section).
- `test` / `test:watch`: vitest.

## Signing keys / Yivi sessions
- `Sealed` is a lazy encryption builder; `toBytes()` and `upload()` are terminal.
- `createEnvelope` calls `toBytes()` then conditionally `upload()`, so signing-key resolution can happen twice (showing two Yivi QR codes) without caching.
- `Sealed.getSigningKeys()` caches the resolved value. Pass pre-resolved keys to `sealRaw`/`encryptPipeline` via the optional `signingKeys` param. The cache is value-based, not promise-based: safe for sequential callers but not concurrent ones.

## Client-side JWT trust boundary
Yivi/IRMA session-result JWTs are decoded without signature verification client-side. Never make a trust decision on a decoded claim. Use `src/util/jwt.ts`'s `decodeJwtPayloadUnsafe` (structural-only decode), then bound the claim's effect:
- `decrypt-session.ts` clamps the cache TTL to `min(exp, now + MAX_CACHE_TTL_SECONDS)`.
- `signing/yivi.ts` intersects disclosed attribute types with the set the client itself requested before building the PKG key request; a client-provided `senderEmail` wins over the JWT value.
The PKG server verifies the signature before issuing keys; the client-side work is defense-in-depth only.
