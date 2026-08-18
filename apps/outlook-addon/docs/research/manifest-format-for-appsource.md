# Which manifest format do we submit to AppSource?

Research for [encryption4all/postguard-js#240](https://github.com/encryption4all/postguard-js/issues/240).
**Researched 2026-08-18.** Every claim below carries the source's own `ms.date`
(authored) and, where useful, `updated_at` (published). This area moves fast:
anything dated 2024 or earlier is flagged as historical and is not load-bearing
for any conclusion here.

## Answer

**Submit the XML add-in only manifest we already ship. Do not port to the unified
Microsoft 365 manifest for this submission.**

The ticket's suspicion is correct, and it is stronger than suspected: the unified
manifest is not merely un-GA on new Outlook for Mac, it is **unsupported** —
Microsoft's own words are "aren't supported in Outlook on Mac", with no roadmap
entry and no preview programme. Mac is one of our two primary targets, so the
fork resolves itself with no trade-off to weigh. XML remains fully accepted for
Marketplace submission, with no deprecation date announced anywhere I could find,
and it is the only format that reaches all four surfaces we care about.

The port is also not the in-place upgrade it looks like. Microsoft requires a
**new GUID** for the unified-manifest version, which makes it a **second
Marketplace listing** beside the first, not an update to ours — plus a
`1.0.0.0` → `1.0.1` version reformat that breaks `scripts/sync-version.mjs`, a
192x192 icon we do not have, and the loss of CI's network store-readiness check.

This does **not** need a separate decision ticket. Revisit only when Microsoft
ships unified-manifest support for Outlook on Mac; until then the answer cannot
change. See [When to revisit](#when-to-revisit) for the exact trigger.

---

## Q1. Does the unified manifest support Outlook add-ins, per platform?

Source for rows 3–6 is the platform-support table in
[Office Add-ins with the unified app manifest for Microsoft 365](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/unified-manifest-overview#client-and-platform-support)
(`ms.date` 2026-05-10, `updated_at` 2026-05-22).

| Platform                     | Unified manifest                                                                      | Source                                                                                                                                                                                                                                                                                   | Date                   |
| ---------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **new Outlook for Mac**      | **Unsupported** (not preview)                                                         | [compare-outlook-add-in-support-in-outlook-for-mac](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/compare-outlook-add-in-support-in-outlook-for-mac); [event-based-activation](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/event-based-activation) fn. 2 | 2026-03-23; 2026-07-30 |
| classic Outlook for Mac      | **Unsupported**                                                                       | same (docs never split new/classic Mac)                                                                                                                                                                                                                                                  | 2026-03-23             |
| **new Outlook for Windows**  | **GA**, no minimum build stated                                                       | unified-manifest-overview                                                                                                                                                                                                                                                                | 2026-05-10             |
| classic Outlook for Windows  | **GA**, Version 2307 (Build 16626.20132)+, **M365 subscription only** (perpetual: No) | unified-manifest-overview                                                                                                                                                                                                                                                                | 2026-05-10             |
| **Outlook on the web**       | **GA**                                                                                | unified-manifest-overview ("Office on the web \| Yes")                                                                                                                                                                                                                                   | 2026-05-10             |
| Outlook mobile (iOS/Android) | **Unsupported**                                                                       | unified-manifest-overview ("Office on mobile \| No"); [outlook-mobile-addins](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/outlook-mobile-addins)                                                                                                                        | 2026-05-10; 2026-04-28 |

For Outlook the docs use a binary Yes/No table with **no preview tier at all**.
Where a platform is Yes it is GA; where it is No there is no preview to opt into.

Verbatim, from the Mac comparison page (`ms.date` 2026-03-23):

> "Add-ins that use the unified manifest for Microsoft 365 aren't supported in
> Outlook on Mac. We're working hard to provide that support. In the meantime, if
> your customer base includes users on the Mac, you need to create a version of
> your add-in that uses the add-in only manifest and support them both."

And a Note on the same page, which matters because it closes the admin-deployment
escape route as well as the store one:

> "Custom add-ins or line-of-business (LOB) add-ins that use the unified manifest
> can be deployed in the Integrated apps portal of the Microsoft 365 admin center,
> but they won't be installable in Outlook on Mac."

The freshest corroboration is footnote 2 of the event-based activation page
(`ms.date` **2026-07-30**, three weeks old at time of writing). Its footnote
marker sits on the **"New Mac UI"**, "Android" and "iOS" rows specifically — so
this is direct evidence about _new_ Outlook for Mac, not an inference from a
generic "Mac" row:

> "Add-ins that use the unified manifest for Microsoft 365 aren't supported in
> Outlook on Mac and on mobile devices. To make your add-in available on Mac and
> on mobile platforms, you must create a second version that uses the add-in only
> manifest."

### Two traps in the older record

Both of these will mislead anyone who re-researches this from search results, so
they are recorded deliberately.

- **The GA blog post says "Mac" and does not mean Outlook.** The
  [unified manifest GA announcement](https://devblogs.microsoft.com/microsoft365dev/unified-manifest-for-office-add-ins-now-ga/)
  (2026-07-16) says GA "across Office for the web, Windows, and Mac". That Mac is
  **Word/Excel/PowerPoint on Mac** (Version 16.103 (25101427)+), which did light
  up. It is not Outlook on Mac; the post defers to the Learn table, and that table
  still says No. This is the single most likely thing to mislead a reviewer.
- **The "publish to Marketplace and an XML manifest is auto-generated for Mac"
  fallback no longer exists.** It was removed by commit
  [`ee4305ca`](https://github.com/OfficeDev/office-js-docs-pr/commit/ee4305ca1de6a71ce99782db0740bc8fe71e8c99)
  ("[All Hosts] (manifest) platform limitations for unified manifest",
  **2025-11-19**, 14 files), which flipped the table rows from
  `Not directly supported` to `No`. Older write-ups and the Build 2024 post
  (2024-05-22 — **historical**, from that removed-fallback era) still describe it.
  There is no escape hatch today.

### Feature gaps that would bite us specifically

- **Event-based activation is unsupported on Mac under the unified manifest**
  (event-based-activation fn. 2, 2026-07-30). Our manifest declares
  `OnNewMessageCompose` and `OnMessageSend` with `SendMode="SoftBlock"` — the
  Smart Alerts send-time path. Porting would drop that on Mac entirely.
- Integrated spam reporting under the unified manifest is **classic Outlook on
  Windows only** ([spam-reporting](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/spam-reporting), `ms.date` 2026-02-27). We do not use it; noted in case it enters scope.
- Outlook modules and Outlook contextual add-ins (activation rules) are
  unsupported under the unified manifest
  ([duplicate-legacy-metaos-add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/duplicate-legacy-metaos-add-ins), `ms.date` 2026-05-10). We use neither.
- A unified-manifest add-in may have **at most 20 add-in commands**, and
  **Visual Studio does not support the unified manifest**
  ([convert-xml-to-json-manifest](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/convert-xml-to-json-manifest), `ms.date` 2026-08-12). We have 2 commands and no Visual Studio, so neither binds.

At the schema level our feature set _is_ expressible — I verified against the
`v1.28` schema bundled in `@microsoft/app-manifest@1.0.8` (in this repo's
`node_modules`) that `extensionAutoRunEventsArray` accepts
`options.sendMode: "softBlock"`, that `scopes` accepts `"mail"`, and that
`formFactors` accepts `["mobile","desktop"]`. The markup exists; the Mac client
support does not. That gap is the whole finding.

## Q2. Does AppSource still accept XML manifests, and is deprecation announced?

**Yes, still accepted. No deprecation date announced** on any page that would
carry one.

The positive statement is in
[Deploy and publish Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/publish)
(`ms.date` 2025-10-10, `updated_at` 2025-10-22). Its primary-publication-methods
table — which lists Microsoft Marketplace as the way "to distribute your add-in
publicly to users" — is introduced with:

> "The following table summarizes the primary publication methods that can be
> used **regardless of which type of manifest the add-in uses**."

The same page then devotes a whole section to "Additional publication methods for
the add-in only manifest" (network share, SharePoint catalog, Exchange server,
Centralized Deployment). XML has _more_ distribution routes than JSON, not fewer,
and the page carries no retirement language.

Note also that the store has been **renamed**: Microsoft's docs now say
"Microsoft Marketplace" (marketplace.microsoft.com) where they used to say
AppSource. That is a rebrand of the destination, not a change of format policy.

Two negative results worth recording, since "no announcement" is a claim that
needs its search shown:

- [Make your solutions available in Microsoft Marketplace and within Office](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center)
  (`ms.date` 2024-11-14 — **historical authoring date** — `updated_at`
  2025-09-25) is the Partner Center submission page for Office add-ins. It
  **does not mention manifest formats at all**, and carries no XML deprecation
  notice. It _does_ carry a deprecation notice for **SharePoint** Add-ins, which
  shows the page is maintained and that Microsoft does put retirement notices
  here when they exist — so its silence on XML is meaningful rather than stale.
- The conversion guide (`ms.date` 2026-08-12) frames conversion as an **opt-in
  upgrade for capability**, not a compliance deadline: you convert "to upgrade an
  add-in ... to a full App for Microsoft 365 to which you can add Teams
  capabilities or a Copilot extension." No deadline language anywhere in it.

## Q3. Is the in-client store fed differently by format?

**No — an XML-manifest add-in appears in the in-client store.** The same
publish page (2025-10-10) describes Microsoft Marketplace as "Microsoft's online
app store which is **accessible through a browser and through the UI of Office
applications**", inside the manifest-agnostic section quoted in Q2. The in-client
"Apps" surface is fed by the Marketplace listing, and Marketplace listings are
manifest-agnostic.

Our own end-user documentation already reflects this working today:
`apps/website/src/lib/locales/en.json:105` walks users through finding the
sideloaded XML add-in under the **"Apps"** menu in the Outlook ribbon.

What the unified manifest actually buys on this axis is **bundling**, not
presence: it lets one installable unit carry an Office add-in plus a Teams app or
a Copilot agent (duplicate-legacy-metaos-add-ins, 2026-05-10). We ship no Teams
app and no Copilot agent, so this is worth nothing to us today.

## Q4. What would switching cost us concretely?

### The three repo mechanisms named in the ticket

| Mechanism                                                | Survives a JSON manifest?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webpack.config.js` localhost→`ADDIN_PUBLIC_URL` rewrite | **Partly.** The string substitution itself survives — the unified manifest is a plain file in the app package, so a `CopyWebpackPlugin` transform still works. But the plugin's `from: "manifest*.xml"` glob and the `scopeAppDomains()` regex (`/^([ \t]*)<AppDomain>([^<]*)<\/AppDomain>[ \t]*\r?\n/gm`) are XML-specific and must be rewritten against JSON's `validDomains` array. Since `scopeAppDomains()` **throws** when a required origin is missing — the guard that stops a send-time `displayDialogAsync` failure no CI job can observe — this is the piece that must not be ported carelessly. |
| `scripts/sync-version.mjs` → `<Version>`                 | **No. Breaks outright, and its core transform becomes illegal.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `office-addin-manifest validate` in CI                   | **Survives as a command, but silently becomes a much weaker check.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### The version padding becomes invalid

This is the sharpest concrete breakage. `scripts/sync-version.mjs` converts
package.json's `x.y.z` into a four-part Office version `x.y.z.0` — that is its
entire purpose, and the manifest today reads `<Version>1.0.0.0</Version>`.

The conversion guide (`ms.date` 2026-08-12, `updated_at` 2026-08-14) requires the
opposite, and uses _our exact current value_ as its example of what must change:

> "Update the value of the `<Version>` element and ensure that it conforms to the
> [semver standard](https://semver.org/) (MAJOR.MINOR.PATCH). Each segment can
> have no more than five digits. **For example, change the value `1.0.0.0` to
> `1.0.1`.** The semver standard's prerelease and metadata version string
> extensions aren't supported."

Confirmed independently against the schema: in `v1.28` of
`MicrosoftTeams.schema.json` (bundled in `@microsoft/app-manifest@1.0.8` in this
repo), the top-level `version` is `{"type":"string", "maxLength":256}` documented
as "must follow the semver standard".

So under JSON the script gets _simpler_ — copy `package.json`'s version verbatim,
delete the four-part padding — but every line of the existing transform goes, and
the regex it uses (`/^(\s*)<Version>([^<]*)<\/Version>/m`) with it. One nuance
worth keeping: the script's refusal to ship a prerelease version stays correct
for the wrong reason. It currently refuses because `0.5.0-rc.1` has no faithful
four-part form; under JSON it must still refuse, because Microsoft explicitly
does not support semver's prerelease extension.

### The validate gate quietly changes meaning

I read the installed `office-addin-manifest@2.1.6` source
(`apps/outlook-addon/node_modules/office-addin-manifest/lib/validate.js`). The
command accepts both formats, but does **two entirely different things**:

- **XML path** — POSTs the manifest to
  `https://validationgateway.omex.office.net/package/api/check?clientId=devx` and
  returns Microsoft's store acceptance-test report. This is a network call
  (already documented in `apps/outlook-addon/CLAUDE.md` as a release-time
  hazard).
- **JSON path** — `AppManifestUtils.readTeamsManifest()` then
  `validateAgainstSchema()`. Purely local, offline, **schema-shape only**.

So switching to JSON _gains_ a deterministic offline gate that a Microsoft outage
cannot fail, and _loses_ the store-readiness pre-check — the thing that currently
tells us before release whether the store would reject the manifest. For a
submission-focused change, losing that is the wrong direction.

Worth noting separately: CI runs `validate:dist` **without** `--production`, so
even today we get the `clientId=devx` flavour rather than the `Default`
(production) one. Adding `-p` is a cheap independent improvement to the
submission path regardless of which format we choose.

### Costs the ticket did not ask about but that fall out of the same change

- **New GUID, therefore a new listing.** The conversion guide (2026-08-12) says
  flatly: "Change the value of the `<ID>` element to a new random GUID." Our
  `<Id>` is `149e61a5-f295-4bcd-be3a-1a6114166f26`. Consequences in Q5.
- **A 192x192 icon we do not have.** The `v1.28` schema requires both
  `icons.color` (192x192) and `icons.outline` (32x32, transparent, white border),
  both as **relative paths inside the zip**, not URLs. I measured
  `apps/outlook-addon/assets/`: we ship 16, 32, 64, 80 and 128 px only. Both a
  192x192 colour icon and a dedicated outline icon are new design assets. The
  packaging code confirms the constraint — `lib/export.js`'s `addZipFile()`
  **skips any path starting with `https://`**, so URL-referenced icons silently
  do not make it into the package.
  (Our existing `<IconUrl>` 64x64 and `<HighResolutionIconUrl>` 128x128 do already
  satisfy the converter's _input_ prerequisite, so that part is fine.)
- **`accentColor` becomes required** (schema `required`: `manifestVersion`,
  `version`, `id`, `developer`, `name`, `description`, `icons`, `accentColor`).
  No XML equivalent exists; it is a new value to choose.
- **`developer.privacyUrl` and `developer.termsOfUseUrl` become required** by the
  conversion guide (2026-08-12). Today the manifest carries only `<SupportUrl>`.
  Both URLs would need to exist on postguard.eu and be maintained.
- **The release asset name changes, and that breaks another app.**
  `.github/workflows/outlook-addon.yml` attaches `dist/manifest.xml` to the
  GitHub release; `apps/website/scripts/sync-addons.mjs:45` matches it with
  `assetPattern: /^manifest\.xml$/i`. A `.zip` app package fails that match with
  a hard error ("no asset matching ... in last N published releases"), so the
  website stops mirroring the add-in. Fails loudly rather than silently, which is
  the good case, but it is a cross-app change in the same PR.
- **User-facing sideload instructions in two locales.**
  `apps/website/src/lib/locales/{en,nl}.json:105` name "manifest.xml",
  `/downloads/postguard-outlook-manifest.xml`, and walk through
  `aka.ms/olksideload`. Both need rewriting for a zip package.
- **nginx serves the manifest by name.** `apps/outlook-addon/nginx/default.conf`
  has `location = /manifest.xml { default_type application/xml; }` plus an
  `application/xml` entry in the cache-control map.
- **The Mac dev loop breaks on the zip path.** In the installed
  `office-addin-debugging@6.1.2`, `lib/start.js:230` routes any `.zip` through
  `extractManifest()`, which builds its temp path from `process.env.TEMP`
  (`lib/start.js:376`; `lib/shared.js:12` does the same). I verified on this
  macOS machine that `TEMP` is unset (`TMPDIR` is set instead) and that
  `path.join(undefined, "x")` throws
  `The "path" argument must be of type string. Received undefined`. So
  `office-addin-debugging start <pkg>.zip` is effectively Windows-only in this
  version — on a Mac you would have to pass `manifest.json` directly to skip that
  branch. Given Mac is a primary target, that is a notably bad dev-loop
  regression to accept in exchange for a format that does not run on Mac anyway.

### What does _not_ change

The `Baked URLs resolve` CI job greps hosts out of `Dockerfile` and
`webpack.config.js` and never reads the manifest, so it is unaffected. The
`DefinePlugin` bundle constants (`ADDIN_PUBLIC_URL`, `PKG_URL`, `CRYPTIFY_URL`,
`POSTGUARD_WEBSITE_URL`, `ADDIN_VERSION`) are independent of manifest format.
`packages/pg-js/tests/ci-wiring.test.ts` asserts **job names**, not the validate
commands (grepping it for `validate` returns nothing), so changing the validate
step breaks no guard — but renaming any of this workflow's five required
contexts (`Lint, typecheck & build`, `Unit tests`, `Baked URLs resolve`,
`Image builds (PR, no push)`, `nginx config test (outlook-addon)`) still would.

### Conversion tooling, for the record

Two official converters exist (conversion guide, 2026-08-12). Ours is not a Yeoman
project, so the applicable one is
`npx office-addin-manifest-converter convert <path-to-XML-manifest>`; the Yeoman
path is `npx office-addin-project convert -m <path>`. Neither is needed under the
recommendation, and neither converts custom functions (which we do not use).
Note the installed `office-addin-manifest@2.1.6` has **no** `convert` command —
its CLI is `info`, `modify`, `validate`, `export`. `export` is the packager: it
zips `manifest.json` at the root plus the colour and outline icons.

## Q5. Can one submission carry both formats?

**No. It is two listings, deliberately made to look like two different products,
then linked so users do not see both.** This is the single most consequential
finding for the submission plan, and it is documented in
[Manage both a unified manifest and an add-in only manifest version of your Office Add-in](https://learn.microsoft.com/en-us/office/dev/add-ins/concepts/duplicate-legacy-metaos-add-ins)
(`ms.date` 2026-05-10, `updated_at` 2026-07-15). Requirements, verbatim:

> - "Give the new version a different name from the existing add-in."
> - "Create and use different icons for the new version."
> - "Be sure that the `"id"` property of the unified manifest in the new version
>   is a different GUID from the `<Id>` element in the add-in only manifest of the
>   existing add-in."

The de-duplication is done in the JSON manifest via
`extensions[].alternates[].hide.storeOfficeAddin`, carrying the old add-in's
`officeAddinId` (GUID) and its Marketplace `assetId` (the `WA…` number). Two
constraints on that mechanism are worth knowing before planning around it:

> "If the asset ID of the add-in that you have linked in your unified manifest
> doesn't match an existing offer published by your seller account, the unified
> manifest submission will fail."

> "An existing add-in can only be hidden by a single unified manifest."

And, importantly for anyone tempted to treat the port as a migration:

> "Don't remove the existing add-in from Microsoft Marketplace or the Microsoft
> 365 Admin Center, or earlier versions of Office will no longer be able to use
> your add-in."

There is also a 24-hour window after install during which **both** versions' UI
is visible (both ribbon buttons appear). So the XML listing is not something you
retire after porting — under Microsoft's own guidance you keep it indefinitely,
and the unified listing is strictly additive work.

One narrow exception exists and does **not** rescue Mac: an admin-deployed
unified-manifest add-in acquired from Marketplace can install on "older versions
of Microsoft 365 and on perpetual license versions of Office". That is about
_older builds_, not about macOS; the Mac page's own Note (Q1) says unified
add-ins deployed through the Integrated apps portal still "won't be installable
in Outlook on Mac".

## Consequences for the wider AppSource submission plan

- **Platform commitments are testable commitments.** The Partner Center
  submission page (`updated_at` 2025-09-25) states: "The validation team tests
  Office Add-ins on all the platforms that the add-in is required to support."
  The certification policies reinforce it — the publish page points at
  [section 1120.3](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies#11203-functionality):
  the add-in "must work across all platforms that support the methods that you
  define". Our manifest declares only `DesktopFormFactor` and requires Mailbox
  1.8/1.12, which is what bounds the claim. We should not widen the listing to
  mobile, and our Yivi dialog flow needs to actually pass on every platform the
  requirement sets imply, not just the two we develop against.
- **Every manifest update goes through certification again.** From the Partner
  Center page (`updated_at` 2025-09-25): "If you make changes after your
  submission is certified, it must go through the certification process again."
  Review is quoted at **3–5 working days** for Office add-ins (Teams and SPFx get
  24 hours — we are not in that lane). That is a real constraint on our release
  cadence: today an `outlook-addin-v*` tag ships a manifest the same hour.
- **Some updates additionally need every admin to re-consent.** The publish page
  (2025-10-10) lists the triggers: changes to requested permissions, changed
  scopes, and "Additional or changed [Events]". We declare `ReadWriteMailbox`
  and two `LaunchEvent` events, so touching either freezes existing users on the
  old version until their admin consents. Worth locking the event list down
  before submitting rather than after.
- **Version discipline becomes mandatory.** "Whenever you make a change to the
  manifest, you must raise the version number of the manifest" (publish page,
  2025-10-10). `pnpm check-version` in CI already enforces exactly this, so we
  are in good shape — that gate becomes a store requirement rather than a
  courtesy.
- **Cheap independent win:** switch CI's `validate:dist` to pass `--production`
  so we validate against the store's `Default` profile rather than `devx`.

## When to revisit

The recommendation is a function of exactly one fact: unified manifest support on
Outlook for Mac. Revisit if **either** of these becomes true:

1. The platform-support table at
   `unified-manifest-overview#client-and-platform-support` flips Outlook on Mac
   from No to Yes, **or** the Mac comparison page drops its "aren't supported"
   paragraph. (There is no roadmap entry to watch — see below — so this has to be
   a periodic re-read of those two pages.)
2. We decide to ship a Teams app or a Copilot agent bundled with the add-in.
   That is the one capability the unified manifest has and XML cannot get, and it
   would justify a **second** listing under Q5's rules — never a replacement of
   the first.

Dropping the XML listing is not on the table at any point: per Q5, retiring it
breaks users on older Office builds.

## What I could not establish

Stated plainly rather than papered over.

- **No explicit Partner Center statement that it accepts a JSON app package for
  Office add-ins.** My Q2 conclusion rests on the _Office_ docs saying
  publication works "regardless of which type of manifest", plus
  duplicate-legacy-metaos-add-ins referring to "the unified manifest submission"
  failing on a bad asset ID (which presupposes such submissions exist). I did not
  find the Partner Center page that spells out the upload artifact per format.
- ~~**A reported "3-part semver vs 4-part version contradiction between the
  Office docs and the Partner Center FAQ" is unverified.**~~ **RESOLVED — the
  contradiction is real.** This entry originally recorded the claim as
  unlocatable. The Partner Center URL was supplied afterwards and the text
  verified against the raw HTML (not a summarizer) on 2026-08-18, under the
  heading "How can I avoid errors when submitting my app to Microsoft
  Marketplace?":

  > "Make sure that the version number on the submission form matches the version
  > number in the app manifest.
  > **Note** — Specify your app version using the following syntax: _a_ . _b_ . _c_
  > . _d_ where _a_ is an integer between 1-9999, and each of _b_ , _c_ , _d_ is an
  > integer between 0-9999. Examples: 1.0.0.0, 6.23.0.1."
  >
  > — [Marketplace submission FAQ](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/appsource-submission-faq),
  > `ms.date: 2025-05-30`

  So Partner Center's submission form documents a **four-part** version with a
  **0-9999** per-segment range, while the Office docs and the bundled schema
  document **three-part** semver with **≤5 digits** per segment. The two are
  mutually exclusive on both axes: `1.0.1` is not expressible as _a.b.c.d_, and a
  5-digit segment exceeds 9999. No Learn page reconciles them.

  This does not change the recommendation — it reinforces it. Our current
  `<Version>1.0.0.0</Version>` is literally the FAQ's own first example and is
  valid for the XML path we are staying on. It matters only if the JSON port in
  [What switching would cost](#what-switching-would-cost) is ever revisited, at
  which point the four-part padding in `scripts/sync-version.mjs` becomes invalid
  against the Office docs while remaining what this FAQ asks for.

- **No Microsoft 365 Roadmap entry exists for unified manifest on Outlook Mac or
  mobile.** Checked against the roadmap's own API on 2026-08-18: 1798 entries,
  **zero** containing the string "manifest" in any field. The Office add-in
  manifest platform is not roadmap-tracked at all, so there is no feature ID,
  phase, or target date to monitor — hence the manual re-read in
  [When to revisit](#when-to-revisit).
- **No ETA, target build, or preview programme for Outlook-on-Mac support.** The
  documented ceiling is the unquantified "We're working hard to provide that
  support."
- **Message Center posts were not checked** — it is tenant-admin-only with no
  public archive, and the roadmap (its public mirror) has nothing.
- **Whether Microsoft distinguishes new vs classic Outlook for Mac for manifest
  purposes.** The docs never split them. The "new Outlook for Mac" row has direct
  evidence (the "New Mac UI" footnote); the "classic Outlook for Mac" row is
  inferred from the flat "Outlook on Mac" statements.
- **Exact minimum build for new Outlook on Windows** — the table gives none.
- **Whether consumer / Outlook.com accounts behave differently** for
  unified-manifest add-ins.
- **Format-dependence of the certification policies themselves.** I read the
  submission-process page and the pointer to section 1120.3, but did not audit
  the full commercial marketplace certification policies for per-format clauses.
- **Re-certification turnaround for a JSON app package** specifically. The 3–5
  working day figure is stated for Office add-ins generally; whether a unified
  manifest submission is routed through the faster Teams/SPFx lane (24 hours) is
  unknown, and could matter if we ever add the second listing.

---

## Addendum (2026-08-18): tooling verified from shipped source

A second pass verified the **tooling** half of Q4 against npm registry metadata and
downloaded package tarballs (reading the shipped JavaScript), rather than against
docs. It changes no conclusion — it makes the switching cost concrete, and turns one
line of the Answer ("loss of CI's network store-readiness check") into a measured
finding.

### `office-addin-manifest` has supported JSON since 2022 — but not equally

JSON support is not new: `manifestHandlerJson`, `export.js` and the `.json` branch of
`validate.js` all ship in **1.8.0 (2022-05-02)**, and the command surface (`info`,
`modify`, `validate`, `export`) has not changed since. Latest is `2.1.6` (2026-07-06).
Dispatch is purely by file extension in `getManifestHandler()`.

**The asymmetry is in `validate`, and it is the real cost of switching:**

|                       | XML path                                                                                                           | JSON path                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| What runs             | `POST validationgateway.omex.office.net/package/api/check`                                                         | `AppManifestUtils.validateAgainstSchema()` — AJV, local                            |
| What it checks        | Microsoft's store-readiness service; returns `notes` / `warnings` / `errors` plus `addInDetails.supportedProducts` | JSON Schema conformance only                                                       |
| `--production` / `-p` | switches `clientId=devx` → `clientId=Default`                                                                      | **silently ignored** — `verifyProduction` is referenced only inside the XML branch |
| Schema source         | fixed                                                                                                              | **fetched at runtime from the manifest's own `$schema`**                           |

Two consequences worth stating plainly. First, `validate` on JSON tells you the file is
well-formed, not that the store will accept it — so the CI gate we have today would
quietly become weaker while still reporting green. Second, because AJV compiles
whatever URL `$schema` names, a manifest pinning an old schema is validated against old
rules, and `@microsoft/app-manifest` throws only if the property is absent entirely.

Also: **`validate` does not accept a `.zip`.** `validateManifest()` calls
`readManifestFile()` first, so a package hits the extension check and throws.

### The replacement gate is a different tool

Store-readiness for a unified manifest lives in the **Microsoft 365 Agents Toolkit
CLI**, `@microsoft/m365agentstoolkit-cli` (latest `1.1.15`, 2026-08-12, with builds
dated daily). Note the predecessors are deprecated on npm —
`@microsoft/teamsapp-cli` (`3.1.1`) says outright _"Please use
@microsoft/m365agentstoolkit-cli instead"_, and `@microsoft/teamsfx-cli` (2024-03-26)
likewise.

`atk validate` takes `--validate-method` of `validation-rules` or `test-cases`, accepts
`--package-file` (so it _does_ validate a zip), and the CLI bundle shows three distinct
drivers — `validateManifest`, `validateAppPackage`, `validateWithTestCases`, the last
importing `AsyncAppValidationResponse`, i.e. a service-side async validation. So the
capability exists; it is simply a different dependency, a different command, and a
different CI step from the one we have.

### The official converter's engine is stale

The documented path is `npx office-addin-project convert -m <path>`, but the wrapper
and the engine are maintained on different clocks:

| Package                                    | Latest    | Published      |
| ------------------------------------------ | --------- | -------------- |
| `office-addin-project` (wrapper)           | 1.0.10    | 2026-07-06     |
| `office-addin-manifest-converter` (engine) | **0.4.1** | **2024-10-28** |

The engine hardcodes `MosManifestGAVersion_1_17 = "1.17"` and writes that `$schema`,
while the current schema is **v1.30** — the conversion doc concedes this by instructing
a manual `$schema` / `manifestVersion` fix-up afterwards. It also **silently truncates**
(`DisplayName` → 30 chars for `name.short`, `Description` → 250 for
`description.short`, `ProviderName` → 32 for `developer.name`), deletes your
`manifest.xml` via `fs.unlinkSync` after writing `backup.zip`, and rewrites
`package.json` scripts and `webpack.config.js`.

### What survives, and the version trap

**The webpack transform survives.** `manifest.json` is an ordinary checked-in file, not
generated — the official `Office-Addin-TaskPane` template ships both
`manifest.outlook.xml` and `manifest.outlook.json` with a literal
`"page": "https://localhost:3000/taskpane.html"`, and the converter's own
`updateWebpackConfig()` merely rewrites the glob from `"manifest*.xml"` to
`"manifest*.json"`. Its source comment concedes the copy plugin should eventually go.

**`sync-version.mjs` does not survive, and the schema will not catch it.** Schema v1.30
declares `version` as `{type: string, maxLength: 256}` with **no `pattern`** — verified
deliberate, since the sibling `hexColor` definition in the same file _does_ carry one.
The real rule lives only in prose: three-part semver, ≤5 digits per segment, and
_"prerelease and metadata version string extensions aren't supported."_ So a
changesets-produced `2.3.4-beta.1` would **pass `office-addin-manifest validate`** and
fail later. Any version-propagation script has to enforce this itself.

**Package assets we do not have.** The zip needs `manifest.json` at its root plus
`color.png` at **192×192** and `outline.png` at **32×32** with a transparent
background, at paths matching the manifest. Today's assets top out at 128×128, and
"outline icon" has no XML equivalent at all.

### One open question in this pass that is already closed elsewhere

This pass listed "whether AppSource currently accepts a unified-manifest Outlook add-in
submission" as unestablished, having found only internal integrated-apps-portal
distribution in the publish doc. **That is answered** by certification policy §1120.1,
which names both formats explicitly: _"All Office Add-ins must use the latest released
(not preview) version of the manifest schema for either the unified manifest for
Microsoft 365 or for the add-in only manifest."_ Recorded here so the two halves of
this document do not read as contradicting each other.
