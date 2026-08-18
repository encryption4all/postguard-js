# AppSource certification gaps for the Outlook add-in

Research for [encryption4all/postguard-js#242](https://github.com/encryption4all/postguard-js/issues/242)
(part of #204, "Publish add-in to Microsoft AppSource").

Read on **2026-08-18** against the add-in as it stands on `main`, and against the
policies as published on that date.

## Primary sources read

| Source                                                                                                                                                     | Version / date as published                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Microsoft Marketplace Certification Policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies)                                 | **Document version 1.67, document date August 26, 2024**. Office add-ins are **section 1120** (1120.1 Offer requirements, 1120.2 Mobile requirements, 1120.3 Functionality, 1120.4 Outlook add-ins functionality, 1120.5 Excel custom functions). The standalone "Office Add-ins validation policies" document is retired and redirects here. |
| [Understanding Outlook add-in permissions](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/understanding-outlook-add-in-permissions)          | `ms.date: 2025-12-02`, `updated_at: 2026-02-25`                                                                                                                                                                                                                                                                                               |
| [Microsoft Marketplace listing options for your event-based add-in](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/autolaunch-store-options) | `ms.date: 2025-10-28`, `updated_at: 2025-12-12`                                                                                                                                                                                                                                                                                               |
| [On-send feature for Outlook add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/outlook-on-send-addins)                                 | `ms.date: 2025-07-22`, `updated_at: 2026-02-25`                                                                                                                                                                                                                                                                                               |
| [Smart Alerts walkthrough](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/smart-alerts-onmessagesend-walkthrough)                            | `ms.date: 2026-02-27`, `updated_at: 2026-03-04`                                                                                                                                                                                                                                                                                               |
| `@types/office-js@1.0.601` (in this repo's `node_modules`)                                                                                                 | Microsoft's own per-API `Minimum permission level` annotations, each linking to the permissions doc above                                                                                                                                                                                                                                     |
| `office-addin-manifest validate dist/manifest.xml`                                                                                                         | Live call to Microsoft's acceptance-test service, run 2026-08-18                                                                                                                                                                                                                                                                              |

Everything under "Evidence" is a file in this repo, or a command whose output is
reproduced in the detail section.

---

## Gap table

Gaps and decisions first; satisfied rows at the bottom.

| Policy point                                                                                                                            | Verdict                             | Evidence (file or fact)                                                                                                                                                                                                                                                                                         | Source                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event-based add-ins get a **restricted** listing (not searchable; event activation only on admin deploy) unless Microsoft 365 Certified | **needs-a-decision**                | `manifest.xml:189-190` declares `OnNewMessageCompose` + `OnMessageSend` LaunchEvents                                                                                                                                                                                                                            | [autolaunch-store-options](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/autolaunch-store-options)                                        |
| `ReadWriteMailbox` is higher than anything the code needs (1100.5 exposure)                                                             | **gap**                             | `manifest.xml:46`; no ReadWriteMailbox-tier API is called anywhere in `src/` — see mapping below                                                                                                                                                                                                                | Cert policies **1100.5**; [permissions doc](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/understanding-outlook-add-in-permissions)       |
| Terms of Use / license terms must exist and be separate from the privacy policy                                                         | **gap**                             | No terms route exists: `apps/website/src/routes/(marketing)/` has `about`, `addons`, `blog`, `privacy` only. `https://postguard.eu/terms` returns HTTP 200 but is byte-identical (2074 B) to a nonexistent route; `/privacy/` is 20455 B                                                                        | Cert policies 1120.1                                                                                                                                     |
| Privacy policy must name the add-in and describe what it collects                                                                       | **gap**                             | `apps/website/src/lib/locales/en.json` `privacypolicy.full` names Yivi as controller but does not cover the add-in's mailbox scope, nor the personal data it persists (`src/lib/settings.ts:47-49`: full name, date of birth, mobile number into `roamingSettings`)                                             | Cert policies 1120.1                                                                                                                                     |
| Privacy policy URL must be a working HTTPS link                                                                                         | **gap**                             | `https://postguard.eu/privacy` → `301` with `location: http://postguard.eu/privacy/` (HTTPS→HTTP downgrade); `http://.../privacy/` → `308` back to `https://.../privacy`. `https://postguard.eu/privacy/` (trailing slash) is a clean `200`                                                                     | Cert policies 1120.1                                                                                                                                     |
| Listing needs a 216–350 px square store logo                                                                                            | **gap**                             | `assets/` tops out at `icon-128.png` (verified 128×128 via `sips`)                                                                                                                                                                                                                                              | Partner Center offer listing requirements                                                                                                                |
| Listing screenshots (at least one)                                                                                                      | **gap**                             | Repo contains no screenshots: `assets/` is 5 icons, `img/` is `pg_logo.svg`                                                                                                                                                                                                                                     | Partner Center offer listing requirements                                                                                                                |
| Validator must be able to exercise the full add-in; third-party companion app                                                           | **needs-a-decision**                | Decrypt requires the Yivi mobile app plus an issued attribute. `src/lib/attributes.ts:13-14` offers two `pbdf.gemeente.personalData.*` attributes, obtainable only via Dutch DigiD ("collect your (Dutch citizen) data via DigiD", [yivi.app](https://yivi.app/en/))                                            | Cert policies 1120.1 / Notes for certification                                                                                                           |
| Listing metadata per claimed language; manifest locale overrides                                                                        | **gap**                             | UI ships `en` + `nl` (`src/lib/i18n.ts:215`, 74/74 key parity) but `manifest.xml` has `DefaultLocale=en-US` (line 6) and zero `<Override Locale=…>`, so add-in name, description, ribbon label and supertips are English-only for a Dutch user                                                                  | [Localization for Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/localization)                                             |
| Three user-facing strings bypass i18n entirely                                                                                          | **gap**                             | `src/taskpane/compose-view.ts:517` (`"Saving encrypted draft…"`), `src/launchevent/launchevent.ts:61` and `:65` — the last two render in the Smart Alert dialog at send time                                                                                                                                    | Same                                                                                                                                                     |
| Add-in must work on every platform the manifest claims                                                                                  | **needs-a-decision**                | Microsoft's validator says it will be tested on **Outlook on Windows, Outlook on Mac, Outlook on the web**. `docs/outlook-quirks.md:131-150` documents that `displayDialogAsync` from the launchevent runtime is broken on Outlook for Mac; `src/launchevent/launchevent.ts:569-572` hard-blocks the send there | Cert policies 1120.3                                                                                                                                     |
| Cryptography must be declared on the submission form                                                                                    | **needs-a-decision**                | Not yet done — no Partner Center submission exists. The add-in bundles a WASM IBE core via `@e4a/pg-js`                                                                                                                                                                                                         | Cert policies **1100.6**: "You must provide details on the offer submission form if your app or add-in calls, supports, contains, or uses cryptography." |
| Support URL must be an unauthenticated HTTPS support page (not a repo)                                                                  | **gap**                             | `manifest.xml:11` is `https://postguard.eu` — the marketing homepage, not a support page. A contact address exists (`info@postguard.eu`) but there is no support landing page                                                                                                                                   | Cert policies 1120.1                                                                                                                                     |
| Listing copy: name, short/long description, categories, keywords                                                                        | **gap**                             | None written. `apps/tb-addon/docs/store-listing.md` is the precedent; no equivalent exists for this add-in                                                                                                                                                                                                      | Partner Center offer listing                                                                                                                             |
| Country/market availability and export considerations                                                                                   | **needs-a-decision**                | No market selection made. Not a code fact — a submission-form decision                                                                                                                                                                                                                                          | Cert policies 1100.6 / Partner Center                                                                                                                    |
| Dormant Graph/MSAL auth code present in the tree                                                                                        | **satisfied (with a hygiene note)** | `src/lib/auth.ts` + `src/lib/graph-client.ts` are imported by nothing but their own test; verified absent from the shipped bundle — `grep` for `graph.microsoft.com`, `getAccessToken`, `OfficeRuntime` over `dist/*.js` returns nothing. No `<WebApplicationInfo>` in the manifest (`grep -c` = 0)             | —                                                                                                                                                        |
| `AppDomains` must not ship localhost/staging in a production listing                                                                    | **satisfied**                       | Built `dist/manifest.xml` contains zero `localhost` and zero `staging` occurrences; AppDomains reduce to `https://postguard.eu`, `https://yivi.app`, `https://addin.postguard.eu`. Done by `webpack.config.js:62-110` (`scopeAppDomains`), which also _fails the build_ if a required origin is missing         | No policy names localhost or staging; this is 1120.3 hygiene                                                                                             |
| Manifest icon sizes                                                                                                                     | **satisfied**                       | `assets/` has 16, 32, 64, 80, 128 px square PNGs, all verified. `IconUrl`=64, `HighResolutionIconUrl`=128, ribbon `bt:Image` 16/32/80 — exactly what a mail add-in needs                                                                                                                                        | Manifest reference                                                                                                                                       |
| HTTPS-only hosting, no remote code                                                                                                      | **satisfied**                       | Only external script is `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` (required). WASM is inlined base64, not fetched. Host serves HSTS `max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, CORS restricted to four Microsoft origins (`nginx/default.conf:19-25`)         | Cert policies 1100                                                                                                                                       |
| Manifest passes Microsoft's own acceptance test                                                                                         | **satisfied**                       | `pnpm validate:dist` → "The manifest is valid." (platform verdict quoted below)                                                                                                                                                                                                                                 | Acceptance test service                                                                                                                                  |
| Legacy `ItemSend` on-send is banned from the marketplace                                                                                | **satisfied**                       | Validator: "Mailbox add-in not containing ItemSend event is valid." The manifest uses the modern `LaunchEvent` mechanism                                                                                                                                                                                        | [on-send doc](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/outlook-on-send-addins)                                                       |
| `SendMode` must be `PromptUser` or `SoftBlock` to be publishable                                                                        | **satisfied**                       | `manifest.xml:190` uses `SendMode="SoftBlock"`                                                                                                                                                                                                                                                                  | [autolaunch-store-options](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/autolaunch-store-options)                                        |
| No broken links among the URLs the build bakes in                                                                                       | **satisfied**                       | `.github/workflows/outlook-addon.yml` "Baked URLs resolve" job asserts every configured host resolves                                                                                                                                                                                                           | Cert policies 1120.1                                                                                                                                     |

---

## Detail

### 1. `ReadWriteMailbox` — nothing in the code requires it

This is the highest-value finding in the ticket, so here is the whole argument.

**What the policy actually says.** There is no ReadWriteMailbox-specific clause
anywhere in certification policies v1.67, and no written-justification gate. The
only hook is **1100.5 Customer control**:

> Your app or add-in may not request unreasonably high permissions or full-control permission.

So the risk is not "you broke rule X"; it is that a reviewer looks at the highest
of four tiers on an add-in whose code needs the third, and calls that
unreasonably high. That is a judgement call we currently have no answer to.

**What the tiers mean.** From the permissions doc (`ms.date: 2025-12-02`):

> **read/write item** … In addition to what is allowed in **read item**, it allows: - full Outlook add-in API access except `makeEwsRequestAsync` - setting the item properties
>
> **read/write mailbox** … In addition to what is allowed in **read/write item**, it allows: - creating, reading, writing items and folders - sending items - calling `makeEwsRequestAsync`

and, under _read/write item — Can do_:

> Read and write all item-level properties of the item that is being viewed or composed in Outlook.
> Add or remove attachments of that item.
> Use all other members of the Office JavaScript API that are applicable to mail add-ins, except **Mailbox.makeEWSRequestAsync**.

The same page tells you how to pick a tier, which is the method used below:

> To make sure that your Outlook add-in specifies the correct permission level, verify the minimum permission level required by each API implemented by your add-in.

**The mapping.** Every Office.js member reached from `src/`, with the minimum
permission level Microsoft annotates on it. Levels were read out of
`@types/office-js@1.0.601`, whose JSDoc carries a
`Minimum permission level` line per member linking to the permissions doc.

| Call site                                             | Member                                                               | Min. permission                    |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| `office-helpers.ts:49,54`                             | `MessageCompose.subject.getAsync` / `setAsync`                       | read item                          |
| `office-helpers.ts:63`                                | `MessageCompose.to`/`cc`/`bcc`.`getAsync` (`Recipients.getAsync`)    | read item                          |
| `office-helpers.ts:76`                                | `MessageCompose.body.getAsync`                                       | read item                          |
| `office-helpers.ts:81`                                | `Body.setAsync`                                                      | **read/write item**                |
| `office-helpers.ts:88`                                | `MessageCompose.getAttachmentsAsync`                                 | read item                          |
| `office-helpers.ts:96`                                | `MessageCompose.getAttachmentContentAsync`                           | read item                          |
| `office-helpers.ts:104`                               | `MessageCompose.removeAttachmentAsync`                               | **read/write item**                |
| `office-helpers.ts:114`                               | `MessageCompose.addFileAttachmentFromBase64Async`                    | **read/write item**                |
| `office-helpers.ts:123`                               | `MessageCompose.saveAsync`                                           | **read/write item**                |
| `office-helpers.ts:138,143`                           | `InternetHeaders.setAsync` / `removeAsync`                           | **read/write item**                |
| `office-helpers.ts:151`, `launchevent.ts:499,665`     | `InternetHeaders.getAsync`                                           | read item                          |
| `office-helpers.ts:158,165,170,175,180,185`           | `MessageRead.attachments`/`body.getAsync`/`subject`/`from`/`to`/`cc` | read item                          |
| `office-helpers.ts:190`                               | `MessageRead.getAllInternetHeadersAsync`                             | read item                          |
| `office-helpers.ts:239`                               | `MessageRead.getAttachmentContentAsync`                              | read item                          |
| `office-helpers.ts:264`                               | `From.getAsync`                                                      | read item                          |
| `office-helpers.ts:252,271,275`                       | `Mailbox.userProfile.emailAddress` / `displayName`                   | read item                          |
| `office-helpers.ts:299,306`, `launchevent.ts:657,658` | `NotificationMessages.replaceAsync` / `removeAsync`                  | read item                          |
| `storage.ts:10,15,20,37`, `pending-upload.ts:29-37`   | `RoamingSettings.get`/`set`/`remove`/`saveAsync`                     | restricted                         |
| `compose-view.ts:245`                                 | `MessageCompose.addHandlerAsync(RecipientsChanged)`                  | read item                          |
| `read-view.ts:319`, `launchevent.ts:165`              | `Office.context.ui.displayDialogAsync`                               | not annotated (no permission gate) |
| `yivi-dialog.ts:109,303`, `read-dialog.ts:186`        | `Office.context.ui.messageParent`                                    | not annotated                      |
| `launchevent.ts:131,458,581,602`                      | `Office.AddinCommands.Event.completed`                               | restricted                         |
| `launchevent.ts:721,722`                              | `Office.actions.associate`                                           | not annotated                      |

**Maximum over the whole set: `read/write item`.**

The complementary check: in the entire Office.js surface only these members are
annotated `read/write mailbox` —

`AppointmentCompose.sendAsync`, `Mailbox.masterCategories` (+ `MasterCategories.addAsync`/`getAsync`/`removeAsync`),
`Mailbox.getSelectedItemsAsync` (+ `SelectedItemDetails.*`), `Mailbox.loadItemByIdAsync`, `Mailbox.makeEwsRequestAsync`.

A `grep` over `src/` for each returns **zero hits**. So do the adjacent
higher-privilege APIs: `getCallbackTokenAsync`, `getUserIdentityTokenAsync`,
`restUrl`, `ewsUrl`, `convertToRestId`, `convertToEwsId`, `displayNewMessageForm`,
`displayMessageForm`, `displayReplyForm`, `getSharedPropertiesAsync`,
`loadCustomPropertiesAsync` — all zero.

The read flow avoids EWS deliberately; `src/taskpane/read-view.ts:155` says so
("Read mode does not give us trailers without makeEwsRequest/Graph"), and takes
the body-marker route instead.

**Does the manifest force the higher tier?** No. Three candidates checked:

- The two `LaunchEvent`s. The Smart Alerts walkthrough (`ms.date: 2026-02-27`)
  contains **no `<Permissions>` element and no mention of permissions at all**.
  Neither does the `OnMessageSend` documentation.
- The legacy `ItemSend` on-send feature is a different mechanism
  (`<ExtensionPoint xsi:type="Events">`), which this manifest does not use — and
  Microsoft's own validator confirmed it: _"Mailbox add-in not containing ItemSend
  event is valid."_ (That mechanism is banned from the marketplace outright:
  _"Add-ins that use the on-send feature aren't allowed in Microsoft Marketplace."_)
- Nothing in the activation rules, `FormSettings`, or the two command surfaces
  ties to a permission tier.

**Conclusion: `<Permissions>ReadWriteItem</Permissions>` is sufficient.** Change
`manifest.xml:46` and every code path above still works. Verify by sideloading and
running both flows — the failure mode for an under-permissioned call is a clear
runtime error, not silence.

Worth noting for the same ticket: `RoamingSettings` only needs **restricted**, and
almost everything else only needs **read item**. The _only_ reason the add-in
cannot drop to `ReadItem` is the compose write path — `Body.setAsync`,
`removeAttachmentAsync`, `addFileAttachmentFromBase64Async`, `saveAsync`,
`InternetHeaders.setAsync`/`removeAsync`. That is exactly what `ReadWriteItem`
exists for.

### 2. Event-based activation caps the listing — the biggest surprise

The manifest declares (lines 189-190):

```xml
<LaunchEvent Type="OnNewMessageCompose" FunctionName="onNewMessageComposeHandler"/>
<LaunchEvent Type="OnMessageSend" FunctionName="onMessageSendHandler" SendMode="SoftBlock"/>
```

That makes this an **event-based activation add-in**, and
[autolaunch-store-options](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/autolaunch-store-options)
(`ms.date: 2025-10-28`) gives such add-ins exactly two listing shapes:

> **Restricted** — Add-in must be deployed by an organization's admin for the event-based activation feature to work. … The add-in isn't searchable by name or ID in Microsoft Marketplace. Users and admins must use a specific flight code URL to install the add-in.
>
> **Unrestricted** — Event-based activation works immediately upon installation by either the user or admin, without requiring admin deployment. … Your add-in must be [Microsoft 365 Certified] and must comply with certain usage requirements.

and:

> Note: While users can install an event-based add-in using a flight code, the add-in won't include event-based activation. However, users can use other components of the add-in, such as a task pane or function command.

So the **default outcome of submitting today** is a listing that is not searchable
in AppSource, reachable only through a flight-code URL we have to hand to admins,
and on which the one-click encrypt-on-send silently does not run for anyone who
self-installs. The taskpane "Encrypt & Send" button still works — which is
fortunate, because it is already the only path on Mac.

Getting a normal searchable listing means **Microsoft 365 Certification**, a
separate and much heavier programme, plus an approval form at
`https://aka.ms/AutoLaunchForEndUser`.

Two things this does _not_ depend on: the permission tier (dropping to
`ReadWriteItem` does not lift the restriction), and `SendMode` — we are already on
the publishable side of that line, since only `Block` is refused outright.

### 3. Reviewer access

The gating fact is not the QR code, it is attribute issuance. To decrypt, the
reviewer must hold `pbdf.sidn-pbdf.email.email` for the mailbox they are reading
(`src/lib/attributes.ts:3`), which means installing Yivi on a phone and completing
an email-verification issuance. That much is doable anywhere.

What is not doable anywhere: `src/lib/attributes.ts:13-14` also offers
`pbdf.gemeente.personalData.surname` and `.dateofbirth`, and
`src/lib/settings.ts:47-49` prefills full name and date of birth from the same
scheme. yivi.app describes obtaining these as "collect your (Dutch citizen) data
via DigiD" — a non-Dutch validator cannot get them at all. If a reviewer picks one
of those attributes from **Manage Access** to see what it does, the flow dead-ends
for reasons that look like a broken add-in.

The Notes for certification field needs to say plainly which attribute to use, and
the same field is where a flight code goes if we take the restricted route
(§2) — the two interact.

### 4. Legal URLs

- **Privacy policy** exists at `https://postguard.eu/privacy/` and names Yivi as
  GDPR controller. Two problems: it never mentions what the _add-in_ touches
  (mailbox item body, recipients, attachments, internet headers), nor that the
  add-in persists full name, date of birth and mobile number into `roamingSettings`
  (`src/lib/settings.ts:47-49`) and a pending-upload record into `localStorage`
  (`src/lib/pending-upload.ts:54`). This is #248's subject.
- **The URL itself is defective.** `https://postguard.eu/privacy` answers `301`
  with `location: http://postguard.eu/privacy/` — a scheme downgrade — and that
  URL answers `308` back to `https://postguard.eu/privacy`. A client without HSTS
  cached loops. Submitting the trailing-slash form avoids it; fixing the redirect
  is better.
- **Terms of Use does not exist.** The site is an SPA that answers `200` for
  everything, so `/terms` _looks_ live: it returns the same 2074-byte shell as
  `/nonexistent-xyz-abc`, against 20455 bytes for `/privacy/`. A "no broken links"
  check would pass while the page is absent.
- **Support URL** (`manifest.xml:11`) points at the marketing homepage. There is a
  contact address (`info@postguard.eu`) but no support page.

### 5. Listing assets

The manifest side is complete and does not need new artwork: `assets/` holds
16/32/64/80/128 px square PNGs, verified with `sips`, and the manifest wires
64 → `IconUrl`, 128 → `HighResolutionIconUrl`, 16/32/80 → ribbon `bt:Image`.

What is missing is on the Partner Center side: a **216–350 px square PNG** store
logo, and **screenshots**. The repo has neither — `img/` is a single
SVG logo. `apps/tb-addon/docs/store-listing.md` is the model to copy: it carries
name, short summary, full description, privacy disclosure, permission
justification and a screenshot checklist, all ready to paste.

### 6. Localisation

`src/lib/i18n.ts:215` ships `en` and `nl` bundles with exact key parity (74/74),
resolved from `Office.context.displayLanguage` (line 218). The manifest declares
`DefaultLocale=en-US` and carries **no** `<Override Locale=…>` anywhere — so for a
Dutch user the taskpane is Dutch while the add-in's name, description, ribbon
group label, button label and both supertips stay English.

Separately, three user-visible strings never reach `t()` at all:
`src/taskpane/compose-view.ts:517`, and `src/launchevent/launchevent.ts:61` and
`:65`. The latter two are the Smart Alert body at send time — the most visible
error surface the add-in has, and English-only regardless of locale.

### 7. Platform claims

Microsoft's acceptance test service, run today against `dist/manifest.xml`,
reports:

> Based on the requirements specified in your manifest, your add-in can run on the following platforms; your add-in will be tested on these platforms when you submit it to the Office Store:
>
> - Outlook on Windows (Microsoft 365)
> - Outlook on Mac (Microsoft 365)
> - Outlook on the web

Against that, `docs/outlook-quirks.md:131-150` records that `displayDialogAsync`
from the launchevent runtime fails on new Outlook for Mac
(`code=-2147467259`) regardless of `AppDomains`, dialog options, size, runtime
declaration or Office.js channel — filed as
[OfficeDev/office-js#6677](https://github.com/OfficeDev/office-js/issues/6677) —
and `src/launchevent/launchevent.ts:569-572` blocks the send on Mac with a Smart
Alert pointing at the taskpane instead.

That is a degraded but not broken path, and the fallback is real. It still needs a
deliberate answer before submission, because a Mac reviewer will hit it. Feeds #245.

### 8. Cryptography — 1100.6

> **1100.6 Global audience**: You must provide details on the offer submission form if your app or add-in calls, supports, contains, or uses cryptography.

This is a disclosure obligation, not a restriction, and it is unambiguously
triggered: the bundle embeds an IBE implementation as base64 WASM through
`@e4a/pg-js`. Nothing in v1.67 forbids or specially restricts encryption, and there
is no ECCN field in the policy text. The work is filling the form in accurately —
and the privacy-disclosure section of `apps/tb-addon/docs/store-listing.md` is
already most of the raw material.

### 9. Dormant auth code — not a gap

`src/lib/auth.ts` (Office SSO / `OfficeRuntime.auth.getAccessToken`) and
`src/lib/graph-client.ts` (Graph folder/message operations) exist with no
`<WebApplicationInfo>` in the manifest (`grep -c` returns 0). They are imported by
nothing except `test/graph-client.test.ts`, and a production build tree-shakes them
out: grepping `dist/*.js` for `graph.microsoft.com`, `getAccessToken` and
`OfficeRuntime` finds nothing.

So there is no undisclosed capability shipping. Nothing in the policies bites on
unreachable source that never reaches the bundle. It is worth deleting or clearly
marking anyway, because the files describe a Graph scope (`Mail.ReadWrite`) the
listing will not declare, and a reviewer reading the public repo may ask. Note also
that enabling it later has a cost beyond the manifest edit: per
autolaunch-store-options, "If the add-in has single sign-on (SSO) enabled, global
admin credentials are needed."

### 10. AppDomains — already handled, and the build enforces it

The source manifest lists six entries including `https://localhost:3000/` and both
staging origins. `webpack.config.js:62-110` (`scopeAppDomains`) rewrites the
localhost origin and drops anything the build does not use, then **fails the build**
if a required origin went missing. Verified by building with the production env
(`ADDIN_PUBLIC_URL=https://addin.postguard.eu/`,
`POSTGUARD_WEBSITE_URL=https://postguard.eu`, …):

```
$ grep -c localhost dist/manifest.xml
0
$ grep -c staging dist/manifest.xml
0
```

leaving `https://postguard.eu`, `https://yivi.app`, `https://addin.postguard.eu`.

No policy in v1.67 mentions `localhost` or `staging` by name, so there is no clause
to cite here — but the production artifact is clean either way, and the transform's
build-time failure is what keeps it that way. Note that the guarantee is
conditional on the build args: a build passed a staging `POSTGUARD_WEBSITE_URL`
would keep the staging origin, which is exactly what the edge image does.

---

## What I could not establish

- **Whether ReadWriteMailbox forces admin-only installation.** The permissions doc
  says only that "You can see the permissions requested by a mail add-in before
  installing it from Microsoft Marketplace" and that admins see required
  permissions in the Exchange Admin Center. It does _not_ say the top tier blocks
  self-service install, and certification policies v1.67 contains no such clause
  either. The admin-deployment constraint I _could_ verify comes from event-based
  activation (§2), not from the permission tier. If someone has seen the
  permission-tier claim stated first-party, it needs its own citation before we
  lean on it as a second argument for dropping to `ReadWriteItem`.
- **The exact Partner Center field limits** (offer name, short/long description
  character counts, keyword count, category list) and the exact screenshot pixel dimensions and file-size cap. These live in the Partner Center
  submission UI and its offer-listing docs rather than in the certification
  policies; I confirmed the assets that are missing but not the character budgets.
- **Whether Microsoft 365 Certification is realistically in scope** for a project
  of this size — cost, elapsed time, and what evidence the framework demands. That
  is the load-bearing unknown for §2 and cannot be answered from the policy text.
- **Whether the AppSource reviewer will accept an email-only walkthrough.** The
  policy requires the add-in be fully exercisable; whether "use the email attribute,
  ignore the DigiD-gated ones" satisfies that is a judgement the certification team
  makes, not something the text settles.
- **Runtime behaviour under `ReadWriteItem`.** The mapping above is derived from
  Microsoft's per-API annotations, not from a sideloaded test. The change is
  cheap to verify and should be verified before it ships.
