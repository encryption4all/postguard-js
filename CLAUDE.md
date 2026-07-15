# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`@e4a/pg-js` — TypeScript browser+Node SDK for PostGuard. PostGuard performs identity-based encryption (IBE): senders encrypt for *identity attributes* (email, phone, etc.) and recipients prove that identity via [Yivi](https://yivi.app) to decrypt. This SDK wraps the `@e4a/pg-wasm` cryptographic core, the PKG (key-generation service) HTTP API, the Cryptify upload server HTTP API, and the Yivi client widgets, exposing them through a small lazy builder surface.

## Common commands

| Task                         | Command              |
|------------------------------|----------------------|
| Install dependencies         | `npm install`        |
| Build (ESM + `.d.mts`)       | `npm run build`      |
| Watch-mode build             | `npm run dev`        |
| Type-check (no emit)         | `npm run typecheck`  |
| Run all tests once           | `npm test`           |
| Watch tests                  | `npm run test:watch` |
| Run a single test file       | `npx vitest run tests/api.test.ts` |
| Run a single test by name    | `npx vitest run -t "name fragment"` |

### Prebuild generators (important)

`prebuild`, `pretypecheck`, and `pretest` all run two generator scripts:

- `scripts/generate-wasm-base64.mjs` — reads `node_modules/@e4a/pg-wasm/web/index_bg.wasm`, writes `src/util/wasm-binary.ts` (base64 of the WASM) AND `src/util/pg-wasm-shim.js` (a patched copy of pg-wasm's `index.js` with wasm-bindgen's `new URL("index_bg.wasm", import.meta.url)` default-value branch stripped — that branch never fires at runtime but webpack 5 fails on it because no separate WASM file ships in our dist).
- `scripts/generate-yivi-css.mjs` — reads `node_modules/@privacybydesign/yivi-css/dist/yivi.css` and writes `src/yivi/yivi-css-text.ts` as a string constant.

All three generated files are git-ignored. If `npm run dev` (which does not run prebuild) is used on a fresh clone, the build will fail until the generators run. Run `npm run prebuild` once, or use `npm run build` / `npm test`.

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

## Supported runtimes

- **Browser** — full surface, including Yivi.
- **Node 22+ / Bun / Deno** — encrypt + upload + decrypt paths work for `sign.apiKey` and `sign.session`. `sign.yivi(...)` throws a clear `YiviSessionError` upfront (it needs a DOM). `result.download()` is browser-only; `result.blob` / `result.plaintext` are universal. Node 22 is the floor because tsdown (the build tool) requires 22.18+; the SDK runtime itself would otherwise work on Node 20.3+, but we don't test or claim support there.

Two non-obvious gotchas for non-browser callers, both already handled in the SDK:

- `FileList` is browser-only. `src/sealed.ts` typeof-guards the `instanceof FileList` check so Node doesn't throw `ReferenceError`.
- `@transcend-io/conflux/dist/esm/bigint.js` references the browser-only `self` global at module load. Bun and Deno alias `self === globalThis`; Node does not. `src/util/zip.ts:importConfluxWithSelfShim()` sets `globalThis.self = globalThis` only for the duration of the dynamic import and restores the prior state in a `finally` — no permanent global mutation.

There's a manual smoke test at `scripts/smoke.mjs` runnable under any of the four runtimes. Without `PG_API_KEY` it runs static checks; with one it does a real upload to staging Cryptify.

## Releases and CI

- `main` is the release branch. `npx semantic-release` runs on push to `main` (`.github/workflows/delivery.yml`), so **commit messages and PR titles must follow Conventional Commits** — `.github/workflows/pr-title.yml` enforces this via `action-semantic-pull-request`.
- `.github/workflows/integration.yml` runs `typecheck + build + test + smoke` across Node 22/24, Bun 1.3.14, and Deno 2.8.0 on every PR. Get the Node lanes green locally before pushing.
- Version in `package.json` is a placeholder (`0.0.0-managed-by-semantic-release`) — do not edit it manually; semantic-release rewrites it during publish.

---

## Agent notes (migrated from the dobby memory repo)

## Overview
`@e4a/pg-js`, the TypeScript SDK. Release: semantic-release.

## Build pipeline (gitignored generated sources)
`src/util/wasm-binary.ts`, `src/yivi/yivi-css-text.ts`, and `src/util/version.ts` are gitignored and generated at build time by `scripts/generate-wasm-base64.mjs`, `scripts/generate-yivi-css.mjs`, and `scripts/generate-version.mjs`. Tests transitively import them. `prebuild`, `pretypecheck`, `pretest`, and `pretest:watch` all run all three generators, so a fresh-clone `npm test` works; CI runs `typecheck` before `test`.

Org-wide lesson: any repo combining gitignored generated sources with build-time hooks needs the generator wired into every script that imports the generated module, not just `build`. When auditing, run `npm test` and `npm run typecheck` directly from a fresh `npm ci` to catch a script that was missed.

## Repo layout
- `src/email/envelope.ts`: HTML template for the PostGuard encrypted email; sender pill styles in `buildAttributePills`.
- CI split: `delivery.yml` (release on push to main), `integration.yml` (PR checks: typecheck + build + test + smoke across Node 22/24, Bun, Deno).

## Package scripts
- `prebuild` / `pretypecheck` / `pretest` / `pretest:watch`: run all three generators.
- `build`: tsdown.
- `typecheck`: `tsc --noEmit`.
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
