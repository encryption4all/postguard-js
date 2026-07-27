## Agent notes (migrated from the dobby memory repo)

## Architecture & toolchain

- SvelteKit (Svelte 5 runes), TypeScript, `adapter-static`. Build: vite. Tests: Playwright (`test:e2e`, specs in `tests/`) + vitest (`test:unit`, specs in `src/**`). Lint: prettier + eslint. Release: Release-please.
- PR titles must be conventional-commit (`fix:`, `feat:`, `chore:`, `docs:`) — the repo runs `amannn/action-semantic-pull-request` via `pr-title.yml`.
- CI runs `npm run test:unit` as a PR gate (added in commit `19e8d9c`). `test:unit` is `svelte-kit sync && vitest run` — the sync is required because the root tsconfig extends the generated `.svelte-kit/tsconfig.json` (vitest errors with `TSCONFIG_ERROR` without it).
- CI also runs `npm run test:e2e` as a PR gate (job `E2E Tests`, chromium only). Playwright's own `webServer` does the `npm run build && npm run preview` on port 4173, so CI and a local run take the identical path. On failure the job uploads `playwright-report/` and `test-results/` (traces + screenshots).
- Bot limitation: the GitHub App cannot push `.github/workflows/` changes — workflow edits need a maintainer.

## Dependency-bump gotchas

- `npm ci` works WITHOUT `--legacy-peer-deps` since `svelte-preprocess@6.0.5` (peer range now allows typescript 6). Do not reintroduce the flag.
- `svelte-preprocess` 6.0.4 broke every `<script lang="ts">` build; 6.0.5 fixed it and is already on main (landed incidentally in commit `a23d1cb`). Do not open a bump PR for #238 — it is resolved.
- Bumping `@sveltejs/kit` to ≥ 2.59 requires adding `@types/node` to devDependencies in the same commit (`svelte-kit sync` writes `"types": ["node"]`, and `svelte-check --threshold warning` treats the missing types as fatal).
- `pg-js` 0.10 → 1.x renamed the notify API: `UploadOptions.notify` is now `{ recipients?, sender?, message?, language? }` with both flags defaulting to `false`. To keep the old behaviour set `recipients: true, sender: true`. Only call site: `src/lib/components/filesharing/SendButton.svelte`.
- `prettier-plugin-svelte` is on `^4.0.1`, which fixed the `{@const}` ternary crash (upstream sveltejs/prettier-plugin-svelte#528). No workaround needed on 4.0.1; the old `$derived` workaround was deliberately reverted (PR #285).

## Encryption / file sharing

- `SendButton.svelte` is the encrypt entry point: builds recipients, calls `pg.recipient.email(...)`, lowercases the email there. `RecipientSelectionFields.svelte` binds input without normalizing.
- Rule: ANY user input feeding `pg.recipient.*()` must be normalized to Yivi's canonical attribute format (email → lowercase; phone → E.164 via `libphonenumber-js/mobile`). Mismatches decrypt to silent KEM errors on the recipient side.
- Trust gate on `/download`: decryption ≠ download. A decrypt success lands on `Confirm` (result held in memory), and the browser download only fires from the user's click (`requestAccept` → `acceptDownload` → `decryptResult.download()`); `Discarded` is the decline state. Warning tiers: `isUnsignedSender` (no email) → strong red warning + `UnsignedConfirmModal`; `isWeakSenderIdentity` (email, no other attrs) → orange; strong identity → none. There is no time-lock anywhere in this flow.
- Sender attribute chips render `attr.value` only (no label lookup, no i18n keys per credential); email is filtered by the `.email.email` suffix, not a loose `includes('email')`.
- Requires `@e4a/pg-js` ≥ 2.0.2 (`unseal` returns verified private `FriendlySender.attributes`); currently `^2.1.4`.
- Do NOT reintroduce the old `SIGN_ATTRIBUTES` ordering workaround (empty `[]` alternative last / `[[attr],[]]` expansion) — the irmamobile bug it worked around is fixed in irmago 1.0. Clean form: empty alternative first, `{ t, optional: true }` shorthand.
- Recipient email validation lives ONLY in `SendButton.svelte` (`validator.isEmail(email.trim())` from the `validator` lib, used by both `canEncrypt` and `getValidationErrors()`). `validator.isEmail` requires a dotted TLD by default, and the address is trimmed before validation and before `pg.recipient.email()` — no-TLD typos used to pass and fail silently.
- Yivi disclosure interruption: `pg.encrypt()` does NOT reject when the user cancels/closes the Yivi app (session `restart` keeps the promise pending). Detect via a `MutationObserver` watching for `.yivi-web-restart-button` in `#crypt-irma-qr`; `YiviQRCode.svelte` raises `oninterrupted` and `SendButton` shows a recovery banner. The QR renders as inline `<svg .yivi-web-qr-code>`, not `<canvas>`.
- Recipient picker on `/download`: `checkRecipients()` filters empty strings BEFORE deciding to show the picker; use a `disabled selected` placeholder option, not `<option value="">`.

## SEO / prerender / nginx

- `adapter-static` with `fallback: '200.html'`; nginx `try_files $uri $uri/ /200.html`. `(marketing)` layout sets `export const trailingSlash = 'always'` so pages emit `/about/index.html` — nginx never tries `$uri.html`. Don't remove it.
- Any unknown path returns 200 with the HTML shell — `curl -I` cannot verify an asset exists; inspect body bytes.
- Links to `+server.js` endpoints (e.g. `/blog/rss.xml`) need `data-sveltekit-reload` — the client router's trailing-slash rewrite breaks them.
- nginx `add_header` shadowing: `Cache-Control` inside `location /` shadows the server-level `X-Frame-Options`/`Referrer-Policy` for HTML responses (`docker/default.conf.template`) — that's why audits report them missing.
- Stripping routes from the production bundle: a runtime dev-redirect does NOT keep code out of the client bundle; use the `excludeDebugRoutesInProduction` Vite plugin pattern in `vite.config.ts` (`enforce: 'pre'`, stub the `+page.svelte` source at build).

## Styling gotchas

- `--pg-font-weight-semibold` is not defined in `global.scss` (falls back to 400). `--pg-input-normal-hover` is a typo — the real token is `--pg-input-hover`. Undefined custom properties are invisible to build/svelte-check; grep the token list in `global.scss` before using one.
- `.primary-btn` sets `width: fit-content` — `align-self: stretch` alone will NOT make it full-width; set `width: 100%` explicitly.
- Scroll container for all `(app)` routes is `<main id="main-content">`, not the window — SvelteKit's window-targeting scroll reset is a no-op app-wide, and `<main>` keeps its scroll across client navigations. Reset it (and nested scrollers like `.inputs-container`) via `afterNavigate`. Playwright: `#main-content` exists only after hydration; pin injected spacers with `flex: 0 0 <h>`.

## Playwright notes

- The send button is intentionally `aria-disabled="true"` (never natively disabled) so it can surface the validation modal — tests must `.click({ force: true })`. Accessible names: button "Sign & send", email field "Email address".
- E2E for a cancelled Yivi disclosure without a real app: mock `POST **/pkg/v2/request/start` (controllable `sessionPtr.u`, no `frontendRequest`), then flip the `/status` mock from `"INITIALIZED"` to `"CANCELLED"`. Preview server port is 4173.
- `playwright.config.ts` must keep `testDir: 'tests'`. Playwright's default testDir is the config's own directory, so without it the runner also collects `src/**/*.test.ts` (the vitest specs) and dies on `Cannot read properties of undefined (reading 'config')` before running anything.
- The browsers in `/opt/ms-playwright` on the agent workspace are a different revision than the one `@playwright/test` pins, so `npx playwright test` cannot find them and the install into that path is not writable. Run `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npx playwright install chromium` once, then prefix runs with the same variable. Leave off `--with-deps` (which the CI job does use): it shells out to `sudo apt-get`, which is unavailable in the workspace, and the whole install then fails.

## Product / copy

- Usage limits: file sharing 5 GB per 14 days. Marketing copy about capacity must explicitly beat the competitor free-tier benchmark (~3 GB/month) — ask for the current benchmark before drafting new copy. Limits appear as hardcoded `<span class="limit-value">` values plus `landing.limits.*` i18n keys — update both together.
- JSON-LD parent organization is Yivi (not Radboud University).
- Outlook-tab copy on `/addons` lives in `src/lib/locales/{en,nl}.json` under `addons.Outlook` (one HTML string) — append new `<li>` items at the end of the `<ol>`.
- The recipient notification email is generated in `encryption4all/cryptify` (`src/email.rs` + `templates/email/*`), NOT here — `EmailPreviewModal.svelte` only previews cryptify's rendered HTML. And a user complaint about a small/hard-to-copy "code" in an email is usually the Yivi email-attribute verification flow (privacybydesign/irmamobile epic #598), not cryptify's download link — check there before routing.
- `UsageWarning` fires when the SENDER's email becomes known (after `pg.sign.yivi(...)` with `includeSender: true`) — never probe on the first recipient email; quotas are per-sender. Server 413 on `POST /fileupload/finalize/<uuid>` is the authoritative backstop.

## Before claiming tests green

Run `npm run test:e2e` (Playwright) and `npm run test:unit` (vitest) once locally before claiming green.
