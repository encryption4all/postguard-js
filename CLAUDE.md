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

## Releases and CI

- `main` is the release branch. `npx semantic-release` runs on push to `main` (`.github/workflows/delivery.yml`), so **commit messages and PR titles must follow Conventional Commits** — `.github/workflows/pr-title.yml` enforces this via `action-semantic-pull-request`.
- `.github/workflows/integration.yml` runs `npm run typecheck && npm run build && npm test` on every PR. Get those three green locally before pushing.
- Version in `package.json` is a placeholder (`0.0.0-managed-by-semantic-release`) — do not edit it manually; semantic-release rewrites it during publish.
