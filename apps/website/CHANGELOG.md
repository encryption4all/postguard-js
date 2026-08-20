# Changelog

## 1.8.4

### Patch Changes

- 9f61ed0: Stop presenting the pre-decryption sender on `/download` as verified.

    The `Ready` state (the screen with the Yivi QR on it, before any user secret key exists and before anything is decrypted) rendered a green tick, the copy "The files are from", and the signing attribute chips next to a sender address read straight off the sealed header via `Opened.inspect()`. That value carries a valid signature over the header bytes, but nothing binds it to the ciphertext (encryption4all/postguard#338): any party the PKG will issue a signing key to can re-sign someone else's header with their own key and be shown in its place. The pg-core change that would detect that swap (encryption4all/postguard#347) works inside the AEAD, so even once it ships in a `@e4a/pg-wasm` release it can only run during decryption, and will never reach this screen.

    `Ready` now keeps the address, because it is what the user needs to decide whether to scan at all and withholding it would make them pay the Yivi cost before learning anything. What it drops is the tick and the chips. The label reads "These files claim to be from", with the caveat "We can confirm this only after decryption." The `Confirm` and `Done` states are unchanged; they render `result.sender` from `decrypt()`, and whether a post-decryption tick is warranted at all is encryption4all/postguard#338's question rather than this change's.

    In `@e4a/pg-js` this is a documentation change only, with no identifier renames. The doc comments on `InspectResult.sender`, `InspectSealedResult.sender`, `inspectSealed()` and `Opened.inspect()` now state that the identity is claimed rather than verified. They stop short of promising that `decrypt()`'s `sender` is bound to the ciphertext, because it is not: the public signing policy travels outside the AEAD in the pinned `@e4a/pg-wasm` (0.6.1) and in every version published as of 2026-08-10 (0.6.3 is the newest), so the swap is reported after decryption too. postguard#347 adds an AEAD-protected copy of the public signing policy to pg-core, and the comments say what it will take for that copy to reach a consumer of this SDK.

- Updated dependencies [9f61ed0]
    - @e4a/pg-js@2.4.1

## 1.8.3

### Patch Changes

- a4aaa77: Repoint the add-on download channels off the archived repositories.

    `/downloads/postguard-tb-addon.xpi` was a 302 to `postguard-tb-addon/releases/latest/download/postguard-tb-addon.xpi` in the dev nginx config. That repository is archived and its `releases/latest` now resolves to the tag `channel-migration-0.9.4`, which carries only `updates.json` and no `.xpi`, so the redirect returned a hard 404. The path now falls through to the dev server, which serves the mirrored artifact from `static/downloads/` — the same thing prod serves from the synced htdocs dir.

    The mirrored artifacts themselves were still the archived repositories' last cuts: the Thunderbird `.xpi` from `postguard-tb-addon` v0.9.3 and, more visibly, the Outlook `manifest.xml` from `postguard-outlook-addon` v0.1.5. `scripts/sync-addons.mjs` has pointed both targets at this repository for a while, so re-running it moves them to `tb-addon-v0.9.4` and `outlook-addin-v1.0.0`.

    Also fixes `docker-compose.prod.yml`, which pulled `ghcr.io/encryption4all/cryptify-backend:edge`. That image name was renamed to `cryptify` years ago and the old name is not a published package, so the compose file could not have pulled it.

- Updated dependencies [5fd30b7]
    - @e4a/pg-js@2.4.0

## 1.8.2

### Patch Changes

- e57e598: Mirror the Outlook add-in manifest from the monorepo's releases instead of the standalone repository, filtered to `outlook-addin-v*` tags so releases of other packages in the shared namespace are not mistaken for add-in releases.

    `outlook-addin-v1.0.0` is published, so the mirror expects a matching release and finding none fails loudly rather than being reported as a state to wait out. The error names both plausible causes, since they call for opposite fixes: the release having scrolled out of the 50-release lookback window — which will happen eventually with nothing wrong, because the tag namespace is shared with `@e4a/pg-js`'s far more frequent changesets releases — or the tag pattern, repo, or published state being wrong.

## [1.8.0](https://github.com/encryption4all/postguard-website/compare/v1.7.0...v1.8.0) (2026-07-28)

### Features

- **decrypt-progress:** show progress bar inside decrypt card with brand blue ([#243](https://github.com/encryption4all/postguard-website/issues/243)) ([e4e66f7](https://github.com/encryption4all/postguard-website/commit/e4e66f79764e79930de45caf8bb0486a6ca31c0a))
- **decrypt:** show private signing attributes on the download page ([#257](https://github.com/encryption4all/postguard-website/issues/257)) ([4d348ae](https://github.com/encryption4all/postguard-website/commit/4d348aeb72a3d28a0ff0843cbefb67d011409225))
- **decrypt:** smooth transitions between Yivi, decrypt, and done states ([#249](https://github.com/encryption4all/postguard-website/issues/249)) ([21abd88](https://github.com/encryption4all/postguard-website/commit/21abd88181c4a8bb89cc3b2a10ebd22cad88a114))
- **emailPreview:** i18n fix, open links in new tab, HTML/text switcher ([#246](https://github.com/encryption4all/postguard-website/issues/246)) ([d52ee5b](https://github.com/encryption4all/postguard-website/commit/d52ee5ba885ca1abc5b1eac9cebc9bdb8db7d643))
- **error-reporting:** CrashReport panel + Sentry-compatible client ([#247](https://github.com/encryption4all/postguard-website/issues/247)) ([a23d1cb](https://github.com/encryption4all/postguard-website/commit/a23d1cb7b7cc2691146eac1a28191d062130d261))
- **filesharing:** add explanatory hover text to recipient attribute buttons ([#316](https://github.com/encryption4all/postguard-website/issues/316)) ([7a39c4b](https://github.com/encryption4all/postguard-website/commit/7a39c4b238a310cd04f73c5f8d4565ecb2bdaffa))
- **filesharing:** one-tap Yivi app open on iOS via pre-warmed session ([#321](https://github.com/encryption4all/postguard-website/issues/321)) ([8c17d11](https://github.com/encryption4all/postguard-website/commit/8c17d11cc1240b7b437ee4bbd4dcb15c4e001ce5))
- **filesharing:** optional name disjunction via condiscon; fix canEncrypt reactivity ([#240](https://github.com/encryption4all/postguard-website/issues/240)) ([00b4187](https://github.com/encryption4all/postguard-website/commit/00b41873170a6b6aedc7a87054d5db6b3118d405))
- **filesharing:** progress bar during download/decrypt + per-file downloads ([#241](https://github.com/encryption4all/postguard-website/issues/241)) ([52bfed7](https://github.com/encryption4all/postguard-website/commit/52bfed7f98aff2045e67e483d6c99332591295b4))
- **home:** homepage onboarding, differentiator-led copy & related fixes ([#312](https://github.com/encryption4all/postguard-website/issues/312)) ([103590e](https://github.com/encryption4all/postguard-website/commit/103590e2745525accc8d1e5953ebf248fc31438f))
- **home:** onboarding "how it works" homepage + compose/sign clarity ([#310](https://github.com/encryption4all/postguard-website/issues/310)) ([ae230dd](https://github.com/encryption4all/postguard-website/commit/ae230ddffe659a3335f9883a35851e27a1067adf))
- **marketing:** plain-language "In short" summaries on About & Privacy ([#311](https://github.com/encryption4all/postguard-website/issues/311)) ([fecf3f2](https://github.com/encryption4all/postguard-website/commit/fecf3f26f47a7d69a9f123a032e0cc5889ebc7ee))
- **metrics:** tag cryptify uploads with X-Cryptify-Source: website ([#228](https://github.com/encryption4all/postguard-website/issues/228)) ([70ee865](https://github.com/encryption4all/postguard-website/commit/70ee86562c47bfc7e04e763014e351cb0563aa21))
- **staging:** in-page preview of cryptify's notification email ([#244](https://github.com/encryption4all/postguard-website/issues/244)) ([7c3e774](https://github.com/encryption4all/postguard-website/commit/7c3e7742840a3890a867eb35f117a26dc3e40db1))

### Bug Fixes

- add X-Content-Type-Options and CSP report-only headers to nginx ([#287](https://github.com/encryption4all/postguard-website/issues/287)) ([a0fdbe6](https://github.com/encryption4all/postguard-website/commit/a0fdbe6d8910530d151aa58c5b0659f4f750efec))
- **blog:** make RSS feed discoverable site-wide ([#262](https://github.com/encryption4all/postguard-website/issues/262)) ([98a063a](https://github.com/encryption4all/postguard-website/commit/98a063a32ca580a18d4f30fc68c294b7bed711ed))
- compose panel — relocate required-fields legend & clarify send-button state ([#300](https://github.com/encryption4all/postguard-website/issues/300)) ([afade9f](https://github.com/encryption4all/postguard-website/commit/afade9fa0d0b8de775c24150c749742600bad2c1))
- **decrypt:** a11y for DecryptionProgress + keep label announceable in banner ([#250](https://github.com/encryption4all/postguard-website/issues/250)) ([277712b](https://github.com/encryption4all/postguard-website/commit/277712bc2cd8dd16cc6981e2b866a3ed0f5f86cf))
- **decrypt:** await postal-mime import in parseMail to avoid race ([#256](https://github.com/encryption4all/postguard-website/issues/256)) ([920c6f1](https://github.com/encryption4all/postguard-website/commit/920c6f16a567a0db6111764ef32503d4363d97df)), closes [#253](https://github.com/encryption4all/postguard-website/issues/253)
- **errorReporting:** minimize data in opt-in crash reports ([#328](https://github.com/encryption4all/postguard-website/issues/328)) ([1ad6af1](https://github.com/encryption4all/postguard-website/commit/1ad6af18e3d07d1395590fed9b7bc363ba805b18)), closes [#325](https://github.com/encryption4all/postguard-website/issues/325)
- exclude /debug/* route group from production build ([#263](https://github.com/encryption4all/postguard-website/issues/263)) ([06df390](https://github.com/encryption4all/postguard-website/commit/06df390ff5502ba8a85aa7fb3daa3dde30662cbe))
- **fileshare:** reset scroll so compose step opens at the top ([#308](https://github.com/encryption4all/postguard-website/issues/308)) ([3d37021](https://github.com/encryption4all/postguard-website/commit/3d37021ad20d093bb80a6f005dfa0a3ed79b4c83))
- **filesharing:** announce decrypt progress to AT, trim removal comment ([#242](https://github.com/encryption4all/postguard-website/issues/242)) ([bc1a1b5](https://github.com/encryption4all/postguard-website/commit/bc1a1b50aa533e9e689afcbd139205ca44600b0e)), closes [#138](https://github.com/encryption4all/postguard-website/issues/138)
- **filesharing:** convey required vs optional fields to assistive tech ([#283](https://github.com/encryption4all/postguard-website/issues/283)) ([24d0a99](https://github.com/encryption4all/postguard-website/commit/24d0a993437c358229ea9620b2220b0947f08137)), closes [#268](https://github.com/encryption4all/postguard-website/issues/268) [#269](https://github.com/encryption4all/postguard-website/issues/269)
- **filesharing:** make attached-file state obvious in the file-attach step ([#307](https://github.com/encryption4all/postguard-website/issues/307)) ([9a8fe47](https://github.com/encryption4all/postguard-website/commit/9a8fe478429fdcc16b68746667196fe532cab23b))
- **filesharing:** make recipient field read clearly as the address field ([#306](https://github.com/encryption4all/postguard-website/issues/306)) ([1e7bf1a](https://github.com/encryption4all/postguard-website/commit/1e7bf1a59cf40285ee79ad9fd4ea7ab88bf10c99))
- **filesharing:** make validation 'continue' button clearly clickable ([#284](https://github.com/encryption4all/postguard-website/issues/284)) ([b2e92c7](https://github.com/encryption4all/postguard-website/commit/b2e92c75fc3a2d4efd8c348e17d24484f148e4cf)), closes [#267](https://github.com/encryption4all/postguard-website/issues/267)
- **filesharing:** open Yivi app from a user tap on iOS ([#319](https://github.com/encryption4all/postguard-website/issues/319)) ([9521fff](https://github.com/encryption4all/postguard-website/commit/9521fff442d168156262a1c9de048555658f3d56))
- **filesharing:** recover gracefully from an interrupted Yivi disclosure ([#305](https://github.com/encryption4all/postguard-website/issues/305)) ([5d33836](https://github.com/encryption4all/postguard-website/commit/5d338363f48bae322aa06b440ed551f9b97629b8))
- **filesharing:** require a real TLD in recipient email validation ([#304](https://github.com/encryption4all/postguard-website/issues/304)) ([57b3c56](https://github.com/encryption4all/postguard-website/commit/57b3c56abab0adac7e281199acf0fbfc6486d1be))
- hide app footer on mobile viewports ([#282](https://github.com/encryption4all/postguard-website/issues/282)) ([ec2a6e5](https://github.com/encryption4all/postguard-website/commit/ec2a6e52d08770c9ae8b3ed31260f7d63eb65e75))
- **nginx:** allowlist Yivi and storage origins in report-only CSP connect-src ([#318](https://github.com/encryption4all/postguard-website/issues/318)) ([6049484](https://github.com/encryption4all/postguard-website/commit/60494844961bc3b66e12d6576feb1b3475d1e8ec))
- **send:** surface empty-state prompt when no file is attached ([#303](https://github.com/encryption4all/postguard-website/issues/303)) ([f1296a0](https://github.com/encryption4all/postguard-website/commit/f1296a04fabd3de6ccb4acb95b1b23195bcc89d6))
- show sender-confirmation notice on the send confirmation page ([#315](https://github.com/encryption4all/postguard-website/issues/315)) ([06c0ba1](https://github.com/encryption4all/postguard-website/commit/06c0ba10ad8f42b7a377efb92fa876f1f20401e2)), closes [#275](https://github.com/encryption4all/postguard-website/issues/275)

## [1.7.0](https://github.com/encryption4all/postguard-website/compare/v1.6.0...v1.7.0) (2026-05-16)

### Features

- **addons:** self-refresh inside the container, drop sync workflow ([#211](https://github.com/encryption4all/postguard-website/issues/211)) ([3dbf9b7](https://github.com/encryption4all/postguard-website/commit/3dbf9b75c091f3b2d1c663b0ca979a32d0f99546))

### Bug Fixes

- **addons:** consolidated install-doc, i18n & UI fixes ([#204](https://github.com/encryption4all/postguard-website/issues/204)) ([cd365ac](https://github.com/encryption4all/postguard-website/commit/cd365acb056edbbd2dae4b171c3c40b8d7b25818))
- consolidated site UX & content fixes ([#202](https://github.com/encryption4all/postguard-website/issues/202)) ([df3ed53](https://github.com/encryption4all/postguard-website/commit/df3ed53044d558b17a354dcb802f9d18e40947b1))
- **decrypt,addons:** dark-mode email body + mobile decrypt overhaul ([#212](https://github.com/encryption4all/postguard-website/issues/212)) ([e970f91](https://github.com/encryption4all/postguard-website/commit/e970f91f00b65c5723808784497a8f5c57b0f76b))
- **decrypt:** consolidated /decrypt page UX fixes ([#203](https://github.com/encryption4all/postguard-website/issues/203)) ([358d000](https://github.com/encryption4all/postguard-website/commit/358d0004660ee6db847047f023e131cf674819e9))
- **filesharing:** inline cancel button, fit responsive QR to parent ([#222](https://github.com/encryption4all/postguard-website/issues/222)) ([92e61c5](https://github.com/encryption4all/postguard-website/commit/92e61c5da52e42af09a99ded302714ddee4608de))
- format script glob only matched directories ([#219](https://github.com/encryption4all/postguard-website/issues/219)) ([d5f0df1](https://github.com/encryption4all/postguard-website/commit/d5f0df1116f8e97e3a368169e884dca124eb1a9f)), closes [#216](https://github.com/encryption4all/postguard-website/issues/216)
- misc website fixes — decrypt UX, dark-mode, QR popup width ([#213](https://github.com/encryption4all/postguard-website/issues/213)) ([2db2dcf](https://github.com/encryption4all/postguard-website/commit/2db2dcf868b9aaaf65f216350151b0751b56cd4e))

## [1.6.0](https://github.com/encryption4all/postguard-website/compare/v1.5.0...v1.6.0) (2026-05-07)

### Features

- **blog:** add RSS feed at /blog/rss.xml ([#149](https://github.com/encryption4all/postguard-website/issues/149)) ([8adcdaf](https://github.com/encryption4all/postguard-website/commit/8adcdafa45eeae4eb367cb8aa32396446a509059))

### Bug Fixes

- **a11y:** WCAG 2.2 AA fixes for marketing layout, app shell, fallback ([#150](https://github.com/encryption4all/postguard-website/issues/150)) ([e04d68f](https://github.com/encryption4all/postguard-website/commit/e04d68f27d7d1540ddb4bce922853a55e36ae733))
- **docker:** serve mirrored addon files instead of redirecting to GitHub ([#147](https://github.com/encryption4all/postguard-website/issues/147)) ([931903f](https://github.com/encryption4all/postguard-website/commit/931903f082fae59dfd470d8c0630dde2527c9b09))
- **qr:** tighten container padding and force white background ([#156](https://github.com/encryption4all/postguard-website/issues/156)) ([4aaf4d3](https://github.com/encryption4all/postguard-website/commit/4aaf4d35636a0b8243d0b13ab2a602e313d95499))
- **sync-addons:** fall back to last release with the expected asset ([#151](https://github.com/encryption4all/postguard-website/issues/151)) ([e13063e](https://github.com/encryption4all/postguard-website/commit/e13063e062b7c05bf377a50b22bb73ed625abf87))

## [1.5.0](https://github.com/encryption4all/postguard-website/compare/v1.4.0...v1.5.0) (2026-05-07)

### Features

- add wide PostGuard logo assets ([#140](https://github.com/encryption4all/postguard-website/issues/140)) ([df394f1](https://github.com/encryption4all/postguard-website/commit/df394f198e0447a325537f2b0dd1b931ce39fd3d))
- **decrypt:** accept ?uuid= and ?recipient= query params ([#131](https://github.com/encryption4all/postguard-website/issues/131)) ([0398c87](https://github.com/encryption4all/postguard-website/commit/0398c87d113ab7b9fc518f4eb9aaf7059745d54a))
- **filesharing:** pg-js 1.4 + transparent retry UX ([#145](https://github.com/encryption4all/postguard-website/issues/145)) ([2a882ad](https://github.com/encryption4all/postguard-website/commit/2a882ad675fe119403f2eb45e647594f72e8b32c))
- serve PostGuard addons directly from the website ([#141](https://github.com/encryption4all/postguard-website/issues/141)) ([98c7b8f](https://github.com/encryption4all/postguard-website/commit/98c7b8f29d25737c96df3bd1521348d5d990b338))
- **static:** add checkmark.png for use in pg-js email envelopes ([#129](https://github.com/encryption4all/postguard-website/issues/129)) ([118e73d](https://github.com/encryption4all/postguard-website/commit/118e73dae145706326cd8df284893898d76baac6))

### Bug Fixes

- **decrypt:** handle large MIME payloads and missing date headers ([#132](https://github.com/encryption4all/postguard-website/issues/132)) ([9901e5d](https://github.com/encryption4all/postguard-website/commit/9901e5db4ee5ea20ef500442dc48427b19077abe))
- **decrypt:** unwrap data.bin from zip in uuid-mode decrypt ([#134](https://github.com/encryption4all/postguard-website/issues/134)) ([4a63b58](https://github.com/encryption4all/postguard-website/commit/4a63b580afbd4694a5acd42db4f6d0eb7aceeaa0))
- **fallback:** guard EmailView against missing postal-mime fields ([#133](https://github.com/encryption4all/postguard-website/issues/133)) ([0891d0c](https://github.com/encryption4all/postguard-website/commit/0891d0c39270bf02dcc9e1c0cd7bfbfdc5752c15))

## [1.4.0](https://github.com/encryption4all/postguard-website/compare/v1.3.0...v1.4.0) (2026-04-30)

### Features

- **fileshare:** warn user before navigating away mid-upload ([#121](https://github.com/encryption4all/postguard-website/issues/121)) ([2c07b8f](https://github.com/encryption4all/postguard-website/commit/2c07b8fccc817968de72926ca8f27a866b16ad1f))

### Bug Fixes

- add missing var() wrappers to CSS custom properties ([#74](https://github.com/encryption4all/postguard-website/issues/74)) ([78e36bf](https://github.com/encryption4all/postguard-website/commit/78e36bfc66f7e6c8860d63534c2e25eb9b9d6f80))
- **download:** skip picker for single recipient and remove empty option ([#119](https://github.com/encryption4all/postguard-website/issues/119)) ([95a0b63](https://github.com/encryption4all/postguard-website/commit/95a0b63abacaf8ba8930b232e207ce168053a346))
- **fileshare:** normalise mobile numbers to E.164 (cryptify[#39](https://github.com/encryption4all/postguard-website/issues/39)) ([#120](https://github.com/encryption4all/postguard-website/issues/120)) ([61bf4ae](https://github.com/encryption4all/postguard-website/commit/61bf4aef69fd78494795d8499be7248869dd19be))

## [1.3.0](https://github.com/encryption4all/postguard-website/compare/v1.2.0...v1.3.0) (2026-04-24)

### Features

- client-side upload limit pre-check via localStorage ([#112](https://github.com/encryption4all/postguard-website/issues/112)) ([c8f05e4](https://github.com/encryption4all/postguard-website/commit/c8f05e4da3931b3619a68a985ae8afb92084e1db))
- upgrade pg-js to 0.10.0, single optional chunk size env var ([#118](https://github.com/encryption4all/postguard-website/issues/118)) ([e422bba](https://github.com/encryption4all/postguard-website/commit/e422bbada4dfa4b60078f5b600e7e19725da934f))
- upload limits — 5 GB cap, landing page section, and usage warnings ([#110](https://github.com/encryption4all/postguard-website/issues/110)) ([2f45930](https://github.com/encryption4all/postguard-website/commit/2f45930a682728197b8d9f0a4cbeba733f451f0b))

### Bug Fixes

- add AI crawler rules to robots.txt and JSON-LD to key pages ([#106](https://github.com/encryption4all/postguard-website/issues/106)) ([cd0ce4c](https://github.com/encryption4all/postguard-website/commit/cd0ce4c561139199c40379b10f3fa0b16e150c1d))
- address high and medium priority SEO audit findings ([#107](https://github.com/encryption4all/postguard-website/issues/107)) ([59a44a5](https://github.com/encryption4all/postguard-website/commit/59a44a587668827d1afd3f7b4f4c7b184e2ed0e0))
- address SEO audit findings (prerender all pages, canonical, JSON-LD, llms.txt) ([#104](https://github.com/encryption4all/postguard-website/issues/104)) ([18e4ac3](https://github.com/encryption4all/postguard-website/commit/18e4ac3ea7ef981f2d08f1e4a83d1efecc218285))
- align upload limits to round GB values (5 GB) ([#115](https://github.com/encryption4all/postguard-website/issues/115)) ([f9f5ebd](https://github.com/encryption4all/postguard-website/commit/f9f5ebd4973114c9201771aef7251fd496b5e763))
- block indexing on non-production environments ([#109](https://github.com/encryption4all/postguard-website/issues/109)) ([4b11fbd](https://github.com/encryption4all/postguard-website/commit/4b11fbdf1ab5058ee382f425f1e2dd2ecd572619))
- prevent footer from overlapping page content on mobile ([#113](https://github.com/encryption4all/postguard-website/issues/113)) ([b15fe96](https://github.com/encryption4all/postguard-website/commit/b15fe96edc7dc544d89d34b231cc3e0870f781a3))
- schema overhaul, authors system, and robots.txt fixes ([#108](https://github.com/encryption4all/postguard-website/issues/108)) ([de0d329](https://github.com/encryption4all/postguard-website/commit/de0d329c602644301f0e358c3de3b47f05f2d266))
- use GB instead of GiB throughout the UI and config ([#114](https://github.com/encryption4all/postguard-website/issues/114)) ([2fa524f](https://github.com/encryption4all/postguard-website/commit/2fa524fa63d91c69163bd3081ce1f5ffa36eb24d))

## [1.2.0](https://github.com/encryption4all/postguard-website/compare/v1.1.2...v1.2.0) (2026-04-18)

### Features

- add FF_BUSINESS feature flag for PostGuard for Business ([#81](https://github.com/encryption4all/postguard-website/issues/81)) ([d3f2ce8](https://github.com/encryption4all/postguard-website/commit/d3f2ce8dcc9292de6af1136a7ea8c4ed53ad515d))
- migrate from @e4a/pg-wasm to @e4a/pg-js SDK ([#72](https://github.com/encryption4all/postguard-website/issues/72)) ([0a29c8d](https://github.com/encryption4all/postguard-website/commit/0a29c8d51b06b5b933b3a591696800baf8f4efb9))
- SEO landing page, blog, and prerendered marketing pages ([#77](https://github.com/encryption4all/postguard-website/issues/77)) ([10aa7b6](https://github.com/encryption4all/postguard-website/commit/10aa7b60be76b282a70a110e5adc5d173b7db259))

### Bug Fixes

- email case normalization and environment-dependent business URL ([#83](https://github.com/encryption4all/postguard-website/issues/83)) ([0e01079](https://github.com/encryption4all/postguard-website/commit/0e010793ccea59b49e0e3dd1df13d947482f8068))
- resolve all svelte-check errors and warnings ([#79](https://github.com/encryption4all/postguard-website/issues/79)) ([9434f72](https://github.com/encryption4all/postguard-website/commit/9434f72753fd335a56216c4e6c7f9df2d2073450))
- use mailto: placeholder for obfuscated contact links ([#80](https://github.com/encryption4all/postguard-website/issues/80)) ([b9a2f80](https://github.com/encryption4all/postguard-website/commit/b9a2f808c578ad9defd3bf9f186d50997cdd8de2))

## [1.1.2](https://github.com/encryption4all/postguard-website/compare/v1.1.1...v1.1.2) (2026-04-03)

### Bug Fixes

- add high-res PostGuard logo PNG for email template ([#69](https://github.com/encryption4all/postguard-website/issues/69)) ([897eb88](https://github.com/encryption4all/postguard-website/commit/897eb884793d0487f0d4661587902e7b9cfa4743))

## [1.1.1](https://github.com/encryption4all/postguard-website/compare/v1.1.0...v1.1.1) (2026-04-03)

### Bug Fixes

- add no-cache header to index.html to ensure new deployments are loaded ([#66](https://github.com/encryption4all/postguard-website/issues/66)) ([5ddaf9e](https://github.com/encryption4all/postguard-website/commit/5ddaf9e2acfcf21b55059941397ab99e08f4598f))

## [1.1.0](https://github.com/encryption4all/postguard-website/compare/v1.0.0...v1.1.0) (2026-04-03)

### Features

- add styled error pages, fix type errors, add svelte-check CI ([#65](https://github.com/encryption4all/postguard-website/issues/65)) ([784166f](https://github.com/encryption4all/postguard-website/commit/784166f385c01c4ca618811f8a6f7367cf2fe07a))

### Bug Fixes

- add inert attribute to background content when popup is shown ([#34](https://github.com/encryption4all/postguard-website/issues/34)) ([062cdc3](https://github.com/encryption4all/postguard-website/commit/062cdc32dc0358186897cd4d29f852be24aee9ef))
- auto-reload page when stale JS chunks cause blank screen ([#63](https://github.com/encryption4all/postguard-website/issues/63)) ([6be8792](https://github.com/encryption4all/postguard-website/commit/6be8792eeebc85645a42676ec8c8a000d18f289f)), closes [#62](https://github.com/encryption4all/postguard-website/issues/62)
- dropzone focus state and add-more-files button semantics ([#32](https://github.com/encryption4all/postguard-website/issues/32)) ([f27eb77](https://github.com/encryption4all/postguard-website/commit/f27eb77c5ccbc61c8e9d197baf9a840645d44592))
- improve design rendering on 1dppx low-density screens ([#40](https://github.com/encryption4all/postguard-website/issues/40)) ([caf6f42](https://github.com/encryption4all/postguard-website/commit/caf6f42c10e362ddcb440cf8374173a363444423))

## 1.0.0 (2026-03-31)

### Features

- add 500 error page ([#55](https://github.com/encryption4all/postguard-website/issues/55)) ([37dcb0f](https://github.com/encryption4all/postguard-website/commit/37dcb0f2fa0e8bccf1f77fb4998104f0474463d3))
- add automated release pipeline with release-please ([#58](https://github.com/encryption4all/postguard-website/issues/58)) ([7fe7d3e](https://github.com/encryption4all/postguard-website/commit/7fe7d3eff4cfb08000eef16fa50e4a7670a0be5d)), closes [#57](https://github.com/encryption4all/postguard-website/issues/57)
- add download button ([0ff10d0](https://github.com/encryption4all/postguard-website/commit/0ff10d0484ba136687cc85ad286f440efb076d77))
- add downloads ([dd1ceb9](https://github.com/encryption4all/postguard-website/commit/dd1ceb936cddeb6bca0f8b5033c065337daa9186))
- add filesharing to multiple recipients ([c60d934](https://github.com/encryption4all/postguard-website/commit/c60d934aa965838de2f200f7c16375b87ced87dd))
- add first version of privacy policy ([59a6129](https://github.com/encryption4all/postguard-website/commit/59a61295b038cd31105f36baf3efeb94bc063ad9))
- add logos in static assets ([4b82671](https://github.com/encryption4all/postguard-website/commit/4b82671169c85295a1f3d5d5a1f7cbbfbc4d3b91))
- add page title ([69b7508](https://github.com/encryption4all/postguard-website/commit/69b75083230705e223c6a19f17fa8db00d45aaa7))
- add preliminary signatures to cryptify ([d7721cd](https://github.com/encryption4all/postguard-website/commit/d7721cda5e769df5c58e3754b63b9e8841436da8))
- always start in list mode ([5f8b0a9](https://github.com/encryption4all/postguard-website/commit/5f8b0a9c9f336a60f3e279f068109f39fafa0d90))
- better mobile experience ([760464c](https://github.com/encryption4all/postguard-website/commit/760464c2aa3030d55d679b3037980e779293b50e))
- cryptify message textarea style ([7770dc9](https://github.com/encryption4all/postguard-website/commit/7770dc9fdfa0b96a3d511d27b10a0ae91e84e989))
- deploy postguard-tb-addon v0.7 ([5f4398b](https://github.com/encryption4all/postguard-website/commit/5f4398b2e7e62ccd18fefd49c2670907060213d9))
- don't lazy load signpost image as it likely the LCP, instead try ([a010dff](https://github.com/encryption4all/postguard-website/commit/a010dff38e7ae9e523e4cea04b2f77c6a87c55f6))
- give iframe border (temporary fix) ([5cbf297](https://github.com/encryption4all/postguard-website/commit/5cbf2977c024f1697da9e50203f198cf2969005c))
- include language switcher ([589b853](https://github.com/encryption4all/postguard-website/commit/589b853d13faf7a163179a3a3e6e246a036738d6))
- include new design encryption screen from Jorrit ([72272af](https://github.com/encryption4all/postguard-website/commit/72272afcc6dabd1a6206d1f8068afafa734a0e07))
- initial CI/CD config ([686944b](https://github.com/encryption4all/postguard-website/commit/686944bb0c6e1d43f66f72c3a88bbbc10c030849))
- initial dutch translation support ([63640a7](https://github.com/encryption4all/postguard-website/commit/63640a70a6e41ed5e1d5535914fabc9103be724f))
- initial signature support in fallback ([0c54718](https://github.com/encryption4all/postguard-website/commit/0c5471814e341e8bfaa2d737533f0928399f4c6c))
- lazyloading big images ([2ab5887](https://github.com/encryption4all/postguard-website/commit/2ab588776619d460fb4f29df16dab598488907ec))
- new color logo ([0c275e5](https://github.com/encryption4all/postguard-website/commit/0c275e5820ce763bf75ea9c123ca72b43d16b416))
- nginx optimizations ([00bf133](https://github.com/encryption4all/postguard-website/commit/00bf1336bbcba25e01ba8d4db6422d483459f282))
- release postguard-tb-addon 0.6 ([f454a22](https://github.com/encryption4all/postguard-website/commit/f454a22f27d1cd1aea4a46e903a170d27af784a5))
- release postguard-tb-addon 0.7.1 ([e719921](https://github.com/encryption4all/postguard-website/commit/e719921348164927a54795312a2699456ce09f45))
- remember language pref ([2a401a5](https://github.com/encryption4all/postguard-website/commit/2a401a5db4d127cae8d30642f374569148958214))
- responsiveness ([bce05a4](https://github.com/encryption4all/postguard-website/commit/bce05a4bc831cd767af91df1e89f60a988627962))
- run svelte-kit in SPA mode ([3bc5bf1](https://github.com/encryption4all/postguard-website/commit/3bc5bf1d79f76435f533f826a60feb3bb6e1bc08))
- send language message to cryptify iframe ([83bf7fe](https://github.com/encryption4all/postguard-website/commit/83bf7fe1e9d99d139d1d7278d66f522dad7b95d8))
- set nginx error log level to info ([d457456](https://github.com/encryption4all/postguard-website/commit/d457456f69cbf06bef1f0fe82c013154e8fb76b0))
- several improvements to translations ([41554f4](https://github.com/encryption4all/postguard-website/commit/41554f4d63eb4cfaa2658543ffd4dfd22ba20a40))
- show list by default, more translations ([2adf488](https://github.com/encryption4all/postguard-website/commit/2adf488577f35295f0972bd38ca8b03cffc12ae5))
- small changes to addon installation instructions ([32b08d6](https://github.com/encryption4all/postguard-website/commit/32b08d62e89f28826adb9ff1e6d17c875a09c041))
- small changes to website (fix fonts in production, etc.) ([a7d990d](https://github.com/encryption4all/postguard-website/commit/a7d990d2314d303e474de25e8032b3a58cf95a6a))
- switch to yivi-web from popup ([3c59d6d](https://github.com/encryption4all/postguard-website/commit/3c59d6db90f58f7d5f8df8c652323f965eb343c1))
- translate yivi ([a82470b](https://github.com/encryption4all/postguard-website/commit/a82470bcbb86fe2133751542f2f3bc44e1342ab2))
- turn on precompression ([c9a4e43](https://github.com/encryption4all/postguard-website/commit/c9a4e43ec4df6b0e74b68ae9b276a810ed56d433))
- underline active language ([0f6df76](https://github.com/encryption4all/postguard-website/commit/0f6df762b1c365622c889eb3763c654bb2a58574))
- update CI config to only run on main ([aada38f](https://github.com/encryption4all/postguard-website/commit/aada38fc63b0165587e2b674e84ee66afc610eb4))
- update cryptify submodule (include metrics header in PKG requests) ([de3ff30](https://github.com/encryption4all/postguard-website/commit/de3ff306343aac9d794a2b66cb3af52c4636c9ec))
- update cryptify to include sender confirmation ([fc1b390](https://github.com/encryption4all/postguard-website/commit/fc1b39063ee67dfc853583204b22baeffdb63b2f))
- update deps ([46c16f9](https://github.com/encryption4all/postguard-website/commit/46c16f9534e04504584d1aa7f9fc837b1323efdd))
- upgrade privacy policy layout ([4b0d7ca](https://github.com/encryption4all/postguard-website/commit/4b0d7ca12c42760dd7e3b08d18f9290fd692c333))
- upgrade to sveltekit 1.0 and refactor current slide using a store ([02b3391](https://github.com/encryption4all/postguard-website/commit/02b33915e626fb238aee0e3a16f39823d99aac4f))
- upgrade to sveltekit 1.0 and refactor current slide using a store ([d349c4b](https://github.com/encryption4all/postguard-website/commit/d349c4bb5655f59897f360fd2aec6ad612d8ef04))
- upgrade Yivi packages to 1.0.0-beta.1, switch to @deltablot/dropzone ([#46](https://github.com/encryption4all/postguard-website/issues/46)) ([7ef7664](https://github.com/encryption4all/postguard-website/commit/7ef7664702f8545bb6705387e121e75306e95677))
- use new irma server ([eed862d](https://github.com/encryption4all/postguard-website/commit/eed862d3e7d7722ab4f9e6a8b1774ccbc2fc5839))
- use new PKG URL in addon and filesharing as well ([c1c754a](https://github.com/encryption4all/postguard-website/commit/c1c754a928e3ee85b3efacc000cfe4eda6fd6624))
- use nginx logs ([0111ef9](https://github.com/encryption4all/postguard-website/commit/0111ef9dc4979f947f80752135c72238cab7ad33))

### Bug Fixes

- add pg-components dependency instead of locally linked ([f50193b](https://github.com/encryption4all/postguard-website/commit/f50193b40928fd3cd6c596ec615f5e7d20649526))
- adjust height instruction ([6132c16](https://github.com/encryption4all/postguard-website/commit/6132c16f0f779f0d5c006fa5728a8e76493f2367))
- apply font to table ([6c6e396](https://github.com/encryption4all/postguard-website/commit/6c6e396bd81025e2780e3f505111a410c7530be9))
- center settings button ([eeb48ff](https://github.com/encryption4all/postguard-website/commit/eeb48ff81544d099133484d705a339b03eddc8f6))
- currentId store ([598624e](https://github.com/encryption4all/postguard-website/commit/598624e130ef3a6a8980b7be493a68db7e45c46c))
- derive domain from email for emaildomain attribute ([#53](https://github.com/encryption4all/postguard-website/issues/53)) ([ce9b3c8](https://github.com/encryption4all/postguard-website/commit/ce9b3c82903ef5ee1d1bb18bb4a1a9e6ace1f4f6))
- disable swiping in instruction ([deee105](https://github.com/encryption4all/postguard-website/commit/deee1055a4dfd8938be9c0a46fb8e937616b2767))
- displayed jwt expiry date ([98f3854](https://github.com/encryption4all/postguard-website/commit/98f3854b9a0b3b1808448d3b9c6dad9ec633cb75))
- do not set url part 2 ([e307e65](https://github.com/encryption4all/postguard-website/commit/e307e65dbd61b29c0fb947710ebf4b8ac4fd7d9c))
- do not show alt text during load ([fc01b47](https://github.com/encryption4all/postguard-website/commit/fc01b470e051a901fc81e8c994011fb128a9b277))
- email regex fix ([f355964](https://github.com/encryption4all/postguard-website/commit/f355964c686500aa48748bf7fb5381f97782e713))
- enable caching on root locations as well ([7efb551](https://github.com/encryption4all/postguard-website/commit/7efb55191677d984dcbef5a7370bb94539ad4408))
- enforce recipient email in Yivi session and add retry on failure ([#47](https://github.com/encryption4all/postguard-website/issues/47)) ([e97ceb5](https://github.com/encryption4all/postguard-website/commit/e97ceb5d60d3965f5785260b5b479bddf38dfee0))
- error in update url in postguard-tb-addon ([9a32233](https://github.com/encryption4all/postguard-website/commit/9a3223317903913de7c0660f92b502c32140325c))
- fallback iframe size ([e39b43e](https://github.com/encryption4all/postguard-website/commit/e39b43e907f970f6ba42bab5753ce00d49c9de31))
- footer ([ade4612](https://github.com/encryption4all/postguard-website/commit/ade46129ac7ed398e39df4a8c65df9c2b9efd6df))
- formatting ([782a795](https://github.com/encryption4all/postguard-website/commit/782a7957a0a509d8c4a67d3dd6b9a05b857d76d5))
- image ([8b06d27](https://github.com/encryption4all/postguard-website/commit/8b06d277e2bade16e713180386c1de6f51be6386))
- loading the cryptify iframe with a url parameter ([4e50344](https://github.com/encryption4all/postguard-website/commit/4e50344102b08e78db2abbe985cb31da230a05f4))
- make &lt;p&gt; elements not swipeable ([befc72b](https://github.com/encryption4all/postguard-website/commit/befc72b3bc229995f7b26d07e88ede1b466a1824))
- make addons instruction not swipeable ([33ded3a](https://github.com/encryption4all/postguard-website/commit/33ded3a6636fbab016b827145dcde69127ce5d5d))
- make top bar less tall ([89fe1e0](https://github.com/encryption4all/postguard-website/commit/89fe1e01777c411c3fb494ea9b4c78159db5fd0e))
- margin under the table ([d18122b](https://github.com/encryption4all/postguard-website/commit/d18122b745d853184591aca3f79241da7a22bc99))
- meta tags ([cac7c58](https://github.com/encryption4all/postguard-website/commit/cac7c583aaad24494f655feb8b05f40ee46943c1))
- nginx sample configuration ([f43a136](https://github.com/encryption4all/postguard-website/commit/f43a1363666752f622f1f0bdeb3da60bb98110ce))
- overflow: scroll -&gt; auto ([a83efdd](https://github.com/encryption4all/postguard-website/commit/a83efddfdc4ede13a94a859ad6804bb962d746b5))
- pass recipient url param to filesharing ([6ca7181](https://github.com/encryption4all/postguard-website/commit/6ca7181ce1aaf1b6d9b37186765c5592b0f99802))
- place input focus outline outside the border ([#30](https://github.com/encryption4all/postguard-website/issues/30)) ([a0ed4ee](https://github.com/encryption4all/postguard-website/commit/a0ed4eeef80cc8b6d19661f529b1e55627755155))
- positioning of header in home slide ([df847ac](https://github.com/encryption4all/postguard-website/commit/df847acfd0a8a5ad16d09d265385c8bffecc5692))
- prefetching does not seem to work like this ([2e179ab](https://github.com/encryption4all/postguard-website/commit/2e179abf86286a19a03ecc865cf11565f1bb021d))
- prevent layout shift on sent page when collapsible opens ([#33](https://github.com/encryption4all/postguard-website/issues/33)) ([7bba52d](https://github.com/encryption4all/postguard-website/commit/7bba52d877ad022bb3fdb75bd814b771d11b80cc))
- privacy policy overflow ([7630824](https://github.com/encryption4all/postguard-website/commit/76308247e7828b2d2e5c6f2e36af96abae535c28))
- redirect old decrypt urls and make sure sw can be found ([eef3d6a](https://github.com/encryption4all/postguard-website/commit/eef3d6ae81555f5b4eef304fc4b8d80e4f2cee93))
- redirect to fallback, not filesharing ([7ae4dcb](https://github.com/encryption4all/postguard-website/commit/7ae4dcbd0e51c9d813945076c51d037987c1ede0))
- remove console_log ([533ddf7](https://github.com/encryption4all/postguard-website/commit/533ddf7ed4a5b86a9dd3489dac4a3ea8eafcaebe))
- remove old fallback build steps in CI ([0a418d8](https://github.com/encryption4all/postguard-website/commit/0a418d8ada034ed26ffd4fb1d859ed4c4dc3b26d))
- replace SVG with PNG in email template ([#37](https://github.com/encryption4all/postguard-website/issues/37)) ([02318cc](https://github.com/encryption4all/postguard-website/commit/02318cc3348d52aae55ae5feb27a5a6854d5a99c))
- reset filesharing slide correctly ([bf51e71](https://github.com/encryption4all/postguard-website/commit/bf51e71fc30ecf846e7e99a33d0603b694e40a76))
- set cryptify iframe min height ([a92a20c](https://github.com/encryption4all/postguard-website/commit/a92a20c1d965387757f5500fe189ce5908479824))
- setting url after swiper has loaded is no longer required due to ([5855ffb](https://github.com/encryption4all/postguard-website/commit/5855ffb2e37affcd73e2bda2dfcf82dfdac6afd7))
- several cryptify bugs ([3ceaf83](https://github.com/encryption4all/postguard-website/commit/3ceaf835c368a7a0c01b836243a43c3322bbd77e))
- show correct error when wrong identity used for decryption ([#36](https://github.com/encryption4all/postguard-website/issues/36)) ([e69e18a](https://github.com/encryption4all/postguard-website/commit/e69e18a47198f8b9ed2a078914da5da3544f3060))
- show email by internally tagged id ([4f55cfc](https://github.com/encryption4all/postguard-website/commit/4f55cfc090d0c30599fc32388c60a402affda388))
- some broken tags ([792f1d0](https://github.com/encryption4all/postguard-website/commit/792f1d016b9ea39b0c40005e058d4831424641ee))
- switch to iframes ([f53f5c0](https://github.com/encryption4all/postguard-website/commit/f53f5c014e4f985700b6afd0530d1086c56f6103))
- translate back button ([349f648](https://github.com/encryption4all/postguard-website/commit/349f6489878ada9669788f3d57fde04c29f96c6e))
- typo ([d2749ca](https://github.com/encryption4all/postguard-website/commit/d2749ca033537a3819ea3f7b8e28022bf1e76e02))
- update CI config to only run on main ([11336df](https://github.com/encryption4all/postguard-website/commit/11336df88ebe5051183c4cdaf472a41b9a08f3f2))
- update cryptify ([935735b](https://github.com/encryption4all/postguard-website/commit/935735bb42f44fa210aa3d93441227e76bbe49e4))
- update dropzone import to @deltablot/dropzone in debug pages ([#49](https://github.com/encryption4all/postguard-website/issues/49)) ([11cae6e](https://github.com/encryption4all/postguard-website/commit/11cae6ee79b1b1a189ddeaac7c82de609863182e))
- update file button in cryptify (dutch) ([0a221cb](https://github.com/encryption4all/postguard-website/commit/0a221cb397a7a59a2afe66c081de34e1417808fb))
- use font-display: swap ([068a9c4](https://github.com/encryption4all/postguard-website/commit/068a9c48226475943de725e19545d68a5f0bd799))
- use select instead of upload terminoligy ([9c8c99f](https://github.com/encryption4all/postguard-website/commit/9c8c99fb0a94ad2ee2878b5022158d8af2301397))
- yivi imports in production mode ([924b0c8](https://github.com/encryption4all/postguard-website/commit/924b0c8a25b8198189b155f767b4c15b5c1d046f))
