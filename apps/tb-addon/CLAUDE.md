# Agent notes (migrated from the dobby memory repo)

## Overview

Thunderbird MV3 extension (manifest v3, `type: "module"`), living at `apps/tb-addon` in the postguard-js monorepo. Release: changesets for the version, then a `tb-addon-v<version>` tag to build and publish the .xpi. See "Release (monorepo)" below — that section is authoritative.

## Architecture

- Background script: `src/background/background.ts` (ESM, event-driven).
- Encryption state tracked in a `composeTabs` Map (in-memory) AND persisted to `storage.local` (MV3 backgrounds can be suspended, losing in-memory state).
- Encryption intercept: `compose.onBeforeSend` -> `handleBeforeSend()` checks `state.encrypt`.
- Encryption itself is delegated to a popup window (Yivi QR scan) via `openCryptoPopup()`.
- Build: esbuild via `build.mjs`; env vars from a `.env` file (`PKG_URL`, `CRYPTIFY_URL`, `POSTGUARD_WEBSITE_URL`); `.env.example` has staging URLs that work for dev. esbuild strips `console.log` in release builds.
- `@transcend-io/conflux` is marked external (unused in extension context).

## Key files

- `src/background/background.ts`: main logic (send intercept, encryption, decryption).
- `src/background/state.ts`: `composeTabs` Map + persistence functions.
- `src/pages/compose-action/compose-action.ts`: toggle popup UI.
- `src/pages/yivi-popup/yivi-popup.ts`: Yivi QR encryption/decryption popup.
- `src/content/message-display.ts`: decrypt banner in message view.
- `src/lib/pkg-client.ts`: env vars.

## Encryption-state persistence

Two failure modes to keep in mind when touching `composeTabs`:

1. An async `windows.onCreated` handler must not unconditionally overwrite `composeTabs` state, if the user toggles encryption before the handler completes, an unconditional write can clobber `encrypt: true` back to `false`. Guard writes with `has()`.
2. The in-memory `composeTabs` Map is lost if the MV3 background is suspended/restarted. Persist encrypt state to `storage.local` so manual toggles survive a suspension.

## x-postguard header

Outgoing encrypted mail sets a `customHeaders` entry `{ name: "x-postguard", value: X_POSTGUARD_VERSION }` on the `onBeforeSend` return. This matches the header cryptify's notification email and the Outlook compose flow set, so a single Outlook `OnMessageRead` matcher on `HeaderName="x-postguard"` works across all three senders. `src/types/thunderbird.d.ts` extends `ComposeDetails.customHeaders?: ComposeCustomHeader[]` for this.

## Test architecture

The unit-test surface is built around small pure helpers extracted from `background.ts` / `yivi-popup.ts`, each living in its own file beside the listener it was lifted out of:

- `src/background/runtime-router.ts`: `dispatchRuntimeMessage` (the `runtime.onMessage` switch).
- `src/background/sent-copy.ts`: `handleAfterSend` (onAfterSend body).
- `src/background/encryption-flow.ts`: `serializeRecipients`, `buildThreadingHeaders`, `evaluateBeforeSendGuards`, `MAX_ATTACHMENT_SIZE`.
- `src/background/decryption-flow.ts`: `chooseDecryptionInput`, `pickRecipientEmail`, `buildDecryptedThreadingHeaders`, `classifyDecryptionError`, `badgesFromSender`.
- `src/pages/yivi-popup/recipients.ts`: `buildRecipients`.

When extracting new listener logic for testability, follow this same pattern: pull the pure logic into its own file, keep only orchestration in the listener body. Tests: vitest.

## Tests run in CI, but are not typechecked

`.github/workflows/tb-addon.yml` runs `check-version`, `typecheck`, `test` and `build` on every PR. What remains true is the narrower point: `tsconfig.json`'s `include` is only `src/**/*.ts(x)`, so `pnpm typecheck` does not cover `tests/`. A type error in a test (e.g. wrong constructor arity) is caught by neither `typecheck` (tests excluded) nor vitest (esbuild strips types without checking). Match constructor signatures by hand when writing tests, CI will not flag test type errors.

## Formatting (prettier only, and NOT checked by CI)

`pnpm lint` is `prettier --check .` and `pnpm format` is `prettier --write .`; the
config is the `prettier` key in `package.json` (`printWidth: 100`,
`trailingComma: "es5"` — prettier's defaults otherwise, which is the 2-space /
double-quote / semicolon style the app was already written in). `.husky/pre-commit`
runs lint-staged here as of #138; before that the app had no formatter at all.

Four things about it that are not obvious.

- **The config is per-app on purpose; do not hoist it to the repo root.** prettier
  resolves config by walking up from each _file_, and a `package.json` without a
  `prettier` key does not stop the search — verified with
  `prettier --find-config-path`, which reports a root `.prettierrc` as the config for
  both `apps/tb-addon/src/lib/utils.ts` and `packages/pg-js/src/index.ts`. So a root
  config is not "shared with `apps/website`", it is _imposed on every package that
  has none_, which today includes the published SDK. The three packages that already
  format disagree deliberately (website: 4-space, no semicolons, svelte plugin;
  outlook-addon: upstream `office-addin-prettier-config`; `examples/pg-sveltekit`:
  tabs, so it looks like what `sv create` emits), so there is no single style to hoist
  to. If a third add-in ever appears, the move is a shared config _package_ each app
  opts into by name, not an inherited root file.
- **`manifest.json` and `updates.json` are in `.prettierignore`.**
  `scripts/sync-version.mjs` writes them with `JSON.stringify(…, null, 2)`, which
  always expands arrays; prettier collapses short ones. Formatting them would make
  `version-packages` and the pre-commit hook take turns rewriting the file.
- **CI does not run `pnpm lint` for this app.** `tb-addon.yml` has no lint step, so
  the hook is the only enforcement and it only sees staged files — `--no-verify`, or a
  commit made by anything that skips hooks, lands unformatted. Adding the lane needs a
  workflow edit plus a matching entry in `packages/pg-js/tests/ci-wiring.test.ts`'s
  `REQUIRED_CONTEXTS` and the ruleset, which is why #138 left it out; tracked
  separately.
- **The app has no eslint config**, and `lint` being prettier-only is why the script
  can share the website's name without meaning the same thing. #138 deliberately did
  not add eslint: rule selection and the resulting fixes are a behaviour change, not a
  reformat.

## Icons / branding

All extension icons live in `public/icons/`: `icon-16/32/64.svg` (manifest icons), `icon-enabled.svg` / `icon-disabled.svg` (compose-action toolbar toggle in `background.ts`'s `updateComposeActionIcon`). The three popups (compose-action, yivi-popup, policy-editor) render the header logo via `icon-64.svg`, so it doubles as the in-UI logo. The build only copies `public/` and `manifest.json` into `dist/`, assets under `img/` (the full brand lockup) are NOT bundled.

## pg-js sender attributes: only email shown before 2.0.0

The decrypt banner shows only the sender's email badge unless `@e4a/pg-js` is 2.0.0 or later. A PostGuard signature has a public part (always-revealed email) and a private part (extra attributes); the private part is verified only during `unsealer.unseal()`, not during header inspection. pg-js before 2.0.0 read the sender via `unsealer.public_identity()` before unsealing, so it only ever held the email. pg-js 2.0.0 made `unseal()` return the post-unseal verified identity, and `parseSender` flattens the public + private attributes into `FriendlySender.attributes`. If a decrypt banner anywhere only shows email despite the sender having signed additional attributes, check the consuming app's pg-js version first (postguard-website and postguard-outlook-addon consume the same library and are subject to the same gotcha if pinned to an older major).

## Per-account sign-attribute prefills

Sign attributes are persisted per Thunderbird account so users don't re-enter them every compose. `state.ts`'s `getSignPrefill(account)` / `setSignPrefill(account, attrs)` store under the `storage.local` key `signPrefills`, keyed by the lowercased from-address (`toEmail(details.from)`), since each TB identity has its own from-address and `ComposeDetails` exposes only `from` (no `identityId`). `setSignPrefill` drops the locked email attribute and blank values; saving an empty/email-only set clears the account's entry. Thunderbird's `AttributeRequest` has no `optional` flag (unlike Outlook's), so prefilled values are simply pre-checked in the existing policy-editor grid.

## Compose encryption-status panel

The compose-window counterpart of the decrypt banner lives in the compose-action popup, NOT injected into the compose editor DOM: a WebExtension can only inject into the compose editor document, and any DOM added there becomes part of the sent message. The popup is the only body-safe surface for compose chrome. `getComposeState` returns `recipients`, `policy`, `signId`, `from`, `hasBcc`, all normalized via `toEmail` so keys match the policy/signId maps. Pure logic (`buildComposeStatusSummary`) is split from DOM rendering (`renderComposeStatusPanel`, jsdom-tested) in `src/pages/compose-action/status-summary.ts`, the same pure-logic/DOM-step split used elsewhere in this repo (e.g. `manage-access.ts`).

## Release (monorepo)

Versions come from changesets: add a changeset, merge, then merging the "Version
Packages" PR bumps `package.json` **and** runs `sync-version`, which mirrors the
version into `manifest.json` and appends an `updates.json` entry. `check-version`
gates that agreement on every PR.

Tags are app-scoped: **`tb-addon-v<version>`**, never `v<version>`. This repo's
tag namespace is shared with `@e4a/pg-js`'s changesets releases (and still holds
the pre-monorepo `v2.3.3`-style pg-js tags), so a bare `v*` would collide.

`manifest.json`'s `update_url` points at
`raw.githubusercontent.com/.../main/apps/tb-addon/updates.json`, **not** a
`releases/latest` asset: in a shared repo `latest` is whichever app released most
recently, so the old URL would have resolved to a pg-js release with no
`updates.json` and broken auto-update for every installed addon.
