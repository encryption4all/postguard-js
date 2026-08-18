# Partner Center publisher identity for the Microsoft Marketplace listing

Research for [encryption4all/postguard-js#241](https://github.com/encryption4all/postguard-js/issues/241)
(part of #204): _can the listing show **PostGuard** as the publisher when the verified
legal entity behind the Partner Center account is **Yivi**?_

All claims below were checked against Microsoft primary sources on **2026-08-18** and are
dated with the source page's own `ms.date` / `updated_at` where Microsoft publishes one.
Anything I could not confirm from a primary source is in
[What I could not establish](#what-i-could-not-establish) rather than stated as fact.

> **Naming note.** "AppSource" no longer exists as a brand. Microsoft renamed the platform
> to **Microsoft Marketplace** and `appsource.microsoft.com` now redirects to
> `marketplace.microsoft.com`, per the April 2026 Partner Center announcements: _"AppSource
> is renamed to Microsoft Marketplace. The https://appsource.microsoft.com link now
> redirects to https://marketplace.microsoft.com."_
> ([2026-april announcements](https://learn.microsoft.com/en-us/partner-center/announcements/2026-april), `ms.date` 2026-04-27).
> An Office Add-in is published through the **Microsoft 365 and Copilot program**, not the
> general Marketplace program.

---

## Answer

**Yes — the listing can say "PostGuard".** Partner Center separates the _verified legal
entity_ (the Legal business profile, which is what identity/business verification checks)
from the **Publisher name**, defined by Microsoft as _"The name displayed in Microsoft
Marketplace with the offer"_ — a free-text field on the Add-publisher form. No
certification policy, and no account-settings page, requires that field to equal the legal
entity, and Microsoft demands no trademark evidence for it at submission.

The real constraint is a _different_ one and it points the same way: the publishing
checklist requires that **`<ProviderName>` match the Publisher name** — not the legal
entity. So `<ProviderName>PostGuard</ProviderName>`, which the manifest already says, is
correct precisely _if_ the Publisher name is also set to "PostGuard". Leave the Publisher
name as a legal entity and the current manifest becomes non-compliant.

Two corrections to the ticket's premises, both load-bearing. **The PostGuard privacy policy
does not name Yivi**: it names _"the iHub team at Radboud University (RU)"_ as operator and
GDPR data controller. And **Yivi does not hold the Yivi brand**: yivi.app states the
trademark sits with Stichting Privacy by Design. Whoever ends up as publisher, the
privacy-policy attribution needs settling — though, usefully, no certification policy
requires the privacy policy to name the publishing entity.

**The one gating unknown is who owns the "PostGuard" mark** — no register evidence was
obtainable here, and the Publisher Agreement makes you warrant you hold the rights (§5b).
Settle that before signing, not before shipping: it gates the signature, not the name.

Realistic plan: **~3–5 business days** to a verified account on a clean first pass,
then **4–6 weeks** to a live listing allowing for at least one rejection round.

---

## 1. Does Partner Center separate the verified legal entity from the publisher display name?

**Yes, and one account can carry several publishers.**

[Add new publishers to Microsoft Marketplace](https://learn.microsoft.com/en-us/partner-center/account-settings/add-publishers)
(`ms.date` 2024-11-26, `updated_at` **2026-04-16**; _Appropriate roles: Owner | Manager_):

> "An organization can have multiple publishers associated with a Microsoft Marketplace account."

The Add-publisher form's fields, verbatim from that page:

- **Publisher location** — "Select the PartnerID you want to use for this new user."
- **Publisher name** — **"The name displayed in Microsoft Marketplace with the offer."**
- **PublisherID** — "An identifier that's used by Partner Center to uniquely identify the
  publisher. […] Because the Publisher ID can't be reused, this field needs to be updated.
  Only lower-case letters, numbers, '-' and '\_' are allowed in a publisher ID."
- **Contact information.**

The Microsoft 365 and Copilot program has its own equivalent page,
[Add new publishers to the Microsoft 365 and Copilot program](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/add-new-publishers-to-office-store-program)
(`ms.date` 2025-01-23, `updated_at` 2025-09-25; _Appropriate roles: **Owners**_), with the
same shape and the add-in-specific wording:

> "**Publisher name**: The name that's displayed in Microsoft 365 and Copilot with the add-in."

That page also confirms the Seller ID is the internal key, not the display name: _"**Seller
ID**: An identifier that's used by Partner Center to uniquely identify the publisher."_

### What constrains the Publisher name

Nothing that I could find imposes a match to the legal entity, and nothing demands
trademark evidence at submission. Specifically:

- The **certification policies** ([document version 1.67 as rendered on the live page,
  observed 2026-08-18](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies))
  contain **no** clause requiring the publisher display name to match a verified legal
  entity. Section **1120 Office Add-ins** — the section that governs this add-in — contains
  no publisher-identity requirement at all; 1120.1 is about the Office.js version, manifest
  schema currency, a valid Support URL, a high-resolution icon, and incrementing the
  version number.
- The nearest thing to a rights requirement is **100.7 Accurate source**, which is an
  attestation about content rather than a demand for proof:
  > "All content in your offer and associated metadata must be either originally created by
  > the offer provider, appropriately licensed from the third-party rights holder, used as
  > permitted by the rights holder, or used as otherwise permitted by law. Offers must be
  > unique and cannot duplicate an offer made available by another publisher on Marketplace."
- **100.1.1 Title** forces a seller's name into the _title_ only in the repackaging case:
  _"If there is no additional intellectual property added to the product, the product title
  must include the seller's name."_ PostGuard is first-party work, so this does not bite.

**Watch item, not a blocker.** Section **1100.7 Easy identification** (which applies to
Microsoft 365 offers generally) says: _"The title may not include your brand or service
unless your offer targets a larger organization or enterprise."_ Read in context with
1100.1 (_"Your offer listing must only describe your app or add-in, and not include
advertising for other offers"_), the target is company-brand padding in a product title,
not a product that _is_ the brand. "PostGuard" is the add-in's own name, so this should
pass — but it is loose enough that a reviewer could raise it, and it is worth a sentence in
the certification notes pre-empting the point.

---

## 2. What must `<ProviderName>` match?

**The Publisher name — explicitly, and this is the one hard naming rule in the whole flow.**

[Microsoft 365 app publishing checklist](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/checklist)
(`ms.date` 2025-03-17, `updated_at` 2025-09-25), Step 3 "Check that your manifest is
compliant", verbatim:

> "Any references to your company name should be identical or very similar to the Publisher
> name in the Partner Center account you're using to submit the app.
>
> - For Office Add-ins, the provider/developer name in the manifest must match the
>   Publisher. The place where you find this name varies depending on the type of manifest.
>   In the add-in only manifest, it's the [ProviderName element](https://learn.microsoft.com/en-us/javascript/api/manifest/providername).
>   In the unified manifest for Microsoft 365, it's the `developer.name` property."

Note what it says and does not say: match **the Publisher**, i.e. the Partner Center
Publisher name field — _not_ the verified legal entity. Set Publisher name to "PostGuard"
and `<ProviderName>PostGuard</ProviderName>` is compliant. Set Publisher name to a legal
entity and the manifest must change to match it.

The schema reference itself is permissive and, notably, **stale**
([ProviderName element](https://learn.microsoft.com/en-us/javascript/api/manifest/providername),
`ms.date` 2018-10-09, `updated_at` 2022-06-30 — four years old, flagged accordingly):

> "Specifies the name of the individual or company that developed this Office Add-in as a
> string of no more than 125 characters."

`apps/outlook-addon/manifest.xml` today carries `<ProviderName>PostGuard</ProviderName>`
(line 5) and `<DisplayName DefaultValue="PostGuard"/>` (line 7). **Both are fine as-is
provided the Publisher name is "PostGuard".** No manifest change is needed for the
preferred outcome; a manifest change _is_ needed for the fallback.

### If we ever move to the unified manifest

The XML add-in-only manifest is still accepted — certification policy **1120.1**:
_"All Office Add-ins must use the latest released (not preview) version of the manifest
schema for **either** the unified manifest for Microsoft 365 **or** for the add-in only
manifest."_ So there is no forced migration today.

The unified manifest's equivalent field is `developer.name`
([root.developer object](https://learn.microsoft.com/en-us/microsoft-365/extensibility/schema/root-developer),
`ms.date` and `updated_at` **2026-08-11** — current as of a week ago): _"The display name
for the developer"_, **required, max 32 characters**. Its own match-Partner-Center rule is
scoped to Teams only — _"For apps submitted to the Teams Store, these values must match the
information in your Teams Store listing"_ — so for an Outlook add-in the binding constraint
is the checklist quoted above, not the schema page.

Two migration gotchas that page surfaces: `termsOfUseUrl` is **required** in the unified
manifest (the XML manifest has no equivalent element and we do not currently have one), and
`mpnId` is optional, max 10 characters.

---

## 3. What does account verification actually demand, and how long?

### The five checks

[Understand the verification process in Partner Center](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process)
(`ms.date` **2026-07-27**, `updated_at` 2026-07-28) is the governing page; its _Appropriate
roles_ line explicitly covers _"Manager or Owner for Developer (for example, Microsoft
Marketplace; Windows and Xbox; Microsoft 365 and Copilot)"_. It names five independent
checks, and _"your account isn't fully verified until all required checks pass"_:

| #   | Microsoft's name            | What it confirms                                                                                                  |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Email verification**      | The primary contact's business email is active and receives mail. Employee business email, not personal/free.     |
| 2   | **Identity verification**   | Identity of at least one user on the account, via a verified credential (VC).                                     |
| 3   | **Employment verification** | The primary contact is an employee of the business — in practice a domain check.                                  |
| 4   | **Business verification**   | The business is legally registered with the appropriate authority in its region and exists at the stated address. |
| 5   | **Additional verification** | Discretionary trustworthiness review; may involve a questionnaire or "mitigating steps".                          |

**No bank or payout verification applies to us.** Per
[Set up Microsoft Marketplace payout and tax profiles](https://learn.microsoft.com/en-us/partner-center/account-settings/set-up-your-payout-account)
(`ms.date` 2024-08-15, `updated_at` 2026-02-25): _"If you only plan to list free offers, you
don't need to fill out any tax forms or set up a payout profile."_ And per the
[submission FAQ](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/appsource-submission-faq)
(`ms.date` 2025-05-30): _"All apps submitted to Microsoft Marketplace via Partner Center are
free."_ So: no IBAN, no W-8BEN, no payout profile.

### Documents Microsoft accepts, and the Netherlands case

The marketplace page is thin — _"formation documents (for example, articles or certificate
of incorporation, business license, registration, or certificate showing dates and business
information)"_. The exhaustive enumeration lives on sibling program pages driven by the same
vetting engine (**OneVet**). From
[Company account verification requirements](https://learn.microsoft.com/en-us/windows/apps/publish/store-business-verification-reqs)
(`ms.date` 2025-02-27, `updated_at` 2026-03-09) and
[Verify your company account information](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/verify-microsoft-edge-program)
(`ms.date` 2022-11-02, `updated_at` **2026-08-12**), accepted types include: formation
documents / articles of incorporation / partnership deed; certificate of incorporation or
registration; government-issued letter, licence, business registration or tax registration
certificate; **record on a government registry website (site/link must be displayed)**;
**extract from commercial register (site/link must be displayed)**; lease or tenancy
documents; letter or statement from a financial institution or utility company; stock
exchange or tax filings; external databases such as **D-U-N-S**; municipal receipts.

Hard freshness rule, verbatim:

> "All submitted documents must have been issued within the past 12 months. If the document
> has an expiration date, it must be valid for at least two more months after the
> submission date."

And the exclusion, from [Submit a verification appeal](https://learn.microsoft.com/en-us/partner-center/enroll/submit-verification-appeal)
(`ms.date` 2026-07-27): **"Not accepted: Self-written documents, screenshots, or unofficial
materials."** Appeals are capped: _"You can submit up to three appeals."_

**KvK:** Microsoft never writes "KvK" or "Kamer van Koophandel" on any page I could find —
flagged below. But a KvK _uittreksel_ is squarely the category Microsoft calls _"extract
from commercial register"_ / _"record on a Government registry website"_, both explicitly
accepted. The parenthetical _"(site/link must be displayed)"_ is the practical catch: the
PDF must show the KvK URL, not be a cropped scan.

**Registration ID is optional for NL.** [Registration ID number information](https://learn.microsoft.com/en-us/partner-center/account-settings/reg-number-id)
(`ms.date` 2024-06-12, `updated_at` 2025-03-10) lists 26 countries where a registration ID is
mandatory — Armenia, Azerbaijan, Belarus, Brazil, China, Hungary, India, Iraq, Kazakhstan,
Kyrgyzstan, Moldova, Myanmar, Poland, Russia, Saudi Arabia, South Africa, South Sudan,
Tajikistan, Thailand, Türkiye, Ukraine, UAE, United States, Uzbekistan, Vietnam, Venezuela.
**The Netherlands is not among them**, so _"a registration ID number is optional"_. A
KvK-nummer may be entered; _"Don't enter a personal ID."_

**Exact-match is the top rejection cause.** Stated on three separate pages, e.g.
[Verify your company profile](https://learn.microsoft.com/en-us/partner-center/account-settings/update-your-partner-profile)
(`ms.date` 2025-06-04, `updated_at` 2026-06-25): the name must be _"free of spelling errors
and abbreviations, and matches your formal company business registration records exactly"_.
For a Dutch B.V. that means the full statutory name including the legal-form suffix.

### Domain ownership — what is actually checked

**The company's own domain, via a website/email match. There is no DNS TXT step in Partner
Center verification, and `postguard.eu` is not itself verified.** From
[verify-microsoft-edge-program](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/verify-microsoft-edge-program):

> "Employment verification confirms that your primary contact is an employee of the
> enrolling company **and that the domain entered in the registration form belongs to the
> enrolling company**. The following information is used to verify employment:
>
> - The company's public website has the same domain that was entered in the registration form.
> - The contact has an active email address on an email domain owned by the company."

If that automated check fails it escalates to documents: _"current domain documentation for
your business […] must match your partner account and include business name, address,
domains, and dates (purchase and expiration) and be from an authorized registrar"_
([understand-the-verification-process](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process)),
or an assignment letter, whois records, or registrar invoices
([verify-microsoft-edge-program](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/verify-microsoft-edge-program)).

Practical consequence: the domain under scrutiny is whichever one goes in the registration
form and hosts the primary contact's work email. If the publishing entity's website is on
one domain and the contact's mail on another, that is exactly the mismatch that triggers a
registrar-document request. Aligning them removes the branch entirely.

The certification policies contain **no** publisher-domain-ownership requirement; they
require only that URLs be valid, functional and HTTPS.

### Employment verification

A domain and email check, not a phone callback. Requirements from
[store-business-verification-reqs](https://learn.microsoft.com/en-us/windows/apps/publish/store-business-verification-reqs):
_"Ensure the email provided is not a generic email or a group alias as an OTP (one time
password) will be sent to verify the email is valid. The email should be an individual's
work email."_ Plus-addressing is rejected: _"We do not allow plus addressing
(abc+xyz@m.com)"_. Personal/free mail is rejected outright. **No phone callback is
documented anywhere** — a phone number is collected, but as public customer-contact data
under the EU Digital Services Act.

**Identity verification** is a separate, single-person bottleneck
([Complete identity verification using verified credentials](https://learn.microsoft.com/en-us/partner-center/enroll/complete-identity-verification),
`ms.date` 2026-07-27): a valid non-expired government-issued ID (passport, driver's licence,
or identity card) plus a mobile device with Microsoft Authenticator. _"For Developer
offerings, only the account's Primary Contact with an appropriate role can complete Identity
Verification."_ _"The name on your government-issued ID must be in the same language and
match the name on your Partner Center account exactly."_ And a two-stage trap: _"Creating a
verified credential does not complete identity verification"_ — you must return to Partner
Center and present it by scanning a QR code. Deadline: _"Complete identity verification
within 30 days of receiving the request. Delays extend the process and might result in your
account verification being rejected."_

### Timelines

| Stage                                     | Microsoft's figure                                                                                            | Source                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overall account verification              | _"In most cases, the process takes **three to five business days**. However, some checks might take longer…"_ | [understand-the-verification-process](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process) (2026-07-27)         |
| Same, corroborated                        | _"Verification usually takes three to five business days."_                                                   | [verify-microsoft-edge-program](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/verify-microsoft-edge-program) (updated 2026-08-12) |
| A check that auto-passes                  | _"typically within a few seconds to a minute"_                                                                | [open-a-developer-account (Windows)](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)                    |
| A check that falls to manual review       | _"Manual reviews typically take 2–5 business days."_                                                          | ibid.                                                                                                                                                   |
| Document-based business verification      | _"approval may take **significantly longer** as the document must go through a review process"_               | [store-business-verification-reqs](https://learn.microsoft.com/en-us/windows/apps/publish/store-business-verification-reqs)                             |
| Identity verification (effort / deadline) | ~15 minutes to complete; **30 days** to respond                                                               | [complete-identity-verification](https://learn.microsoft.com/en-us/partner-center/enroll/complete-identity-verification)                                |
| Appeal review                             | **No SLA.** _"The time it takes to review an appeal varies."_                                                 | [submit-verification-appeal](https://learn.microsoft.com/en-us/partner-center/enroll/submit-verification-appeal)                                        |
| Status propagation                        | _"up to 30 minutes […] to fully reflect across Partner Center"_                                               | [open-a-developer-account (Windows)](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account)                    |

Then, separately, the **submission** clock once the account is authorised:

- _"The validation team reviews your submission. The review can take **3-5 working days**,
  depending on the volume of submissions in the queue."_
  ([submit-to-appsource-via-partner-center](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center),
  `ms.date` 2024-11-14, `updated_at` 2025-09-25)
- _"Submitting your app for review can take **up to four weeks** from first submission until
  final approval"_, and _"Your validation application might not be approved at first
  submission. **This is common if this is your team's first time submitting an app.**"_
  ([checklist](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/checklist))
- After certification: _"a product typically appears in Microsoft Marketplace within **one
  hour**."_

**Realistic planning number: ~1 week to a verified account on clean documents, then 4–6
weeks to a live listing assuming at least one rejection round.** The tail risk is a rejected
business or domain check: appeals have no published SLA and you get three.

### What is blocked before verification completes

> "Until verification is complete, some Partner Center capabilities are limited. For
> example, your business might not be able to purchase certain offers, **publish content**,
> or manage key account settings until the process is complete."
> — [understand-the-verification-process](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process)

And _"After your account is approved, you can submit your solution to Partner Center."_
Failure is hard: _"The vetting status is based on 5 factors. If any of those factors have a
failure, the publisher will show as rejected and cannot publish."_
([store-business-verification-reqs](https://learn.microsoft.com/en-us/windows/apps/publish/store-business-verification-reqs))

Two one-way doors worth knowing before anyone starts typing:

- **Editing key details restarts everything.** _"Updating key details will restart the
  verification process, and any previous appeals or related history will not be carried
  over."_ ([open-a-developer-account (Windows)](https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account))
- **Individual → Company is not convertible.** _"Changing a developer account from
  Individual to Company is not supported in Partner Center."_ Pick Company at the start.

---

## 4. Is there a "publish on behalf of" arrangement — and do we even need one?

**Short answer: no such construct is documented, and we almost certainly do not need one,
because Caesar and Yivi are the same corporate group.**

### The entity structure (verified 2026-08-18)

From [yivi.app/en/about_yivi/](https://yivi.app/en/about_yivi/), verbatim:

> "Yivi is offered by Yivi B.V., a subsidiary of Caesar Groep Rotterdam B.V., in
> collaboration with Stichting Privacy by Design."
>
> "Yivi B.V. is a private limited company, based in and operating from Utrecht, registered
> with the Chamber of Commerce under number [redacted]. It is a 100% subsidiary of Zonnebaan
> Investments B.V., which is in turn a 100% subsidiary of Caesar Groep Rotterdam B.V."

So the chain is **Yivi B.V. → Zonnebaan Investments B.V. → Caesar Groep Rotterdam B.V.**,
with an intermediate holding company the ticket did not mention. Caesar is not a third party
to Yivi; it is its ultimate parent. "Caesar operates an account owned by Yivi" is therefore
an **intra-group administration question**, not a cross-company delegation problem, and none
of the reseller/CSP/multiparty-private-offer machinery is relevant.

They are nonetheless **separate legal entities with separate KvK numbers**, and Partner
Center verification is per legal entity — so whichever one enrols is the one that must pass
business verification, and the other one's staff get in through user administration.

### Why no delegation construct exists anyway

The Microsoft Publisher Agreement makes the publisher a single, non-delegable legal person.
[MPA version 8.0, effective July 1, 2026](https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement)
(page `updated_at` 2026-05-27):

- §2(a): _"You are solely responsible and liable for the Offer, including all delivery and support."_
- §11(b): _"You may not assign or delegate any rights or obligations under this Agreement,
  including in connection with a change of control. Any purported assignment and delegation
  will be ineffective."_

Account creation reinforces it
([Create a Microsoft Marketplace account](https://learn.microsoft.com/en-us/partner-center/account-settings/create-account),
`ms.date` 2024-12-12, `updated_at` 2026-07-27): _"You must use a work account associated with
your company or organization. Personal accounts aren't supported."_ and _"You must have
authority to sign legal agreements on your company's behalf."_

Microsoft's adjacent models do not fit and should not be pursued: **multiparty private
offers** are a private per-customer pricing channel that presupposes the public listing
already exists under the software company's own account; **CSP reselling** is resale, not
publishing. Neither transfers publisher identity.

### The access model that is documented, with exact role names

If Yivi B.V. holds the account and Caesar staff need in, Microsoft documents guest access
explicitly. [Roles, permissions, and workspace access](https://learn.microsoft.com/en-us/partner-center/account-settings/permissions-overview)
(`ms.date` 2025-12-26, `updated_at` 2026-06-25), section _Guest user role_, verbatim:

> "External user invited as guest user in Entra. Guest users can only be assigned MPN Admin,
> Business Profile Admin, Referral Admin for MAICPP, **Manager or Developer role for
> Marketplace or developer programs**."

That is the entire allowlist. A guest **cannot** be `Owner`, `Finance Contributor`,
`Business Contributor` or `Marketer`.

The marketplace/developer-program roles, spelled as Microsoft spells them:

| Role                     | Can do (verbatim extracts)                                                                                                                                                                                                                           | Guest-assignable |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Owner**                | _"Manage developer profile · Create and manage publisher accounts · Manage payout and tax information · Enroll publisher accounts into developer programs · Assign roles for seller account"_; _"Manage offer types / Set and update offer pricing"_ | **No**           |
| **Manager**              | _"Manage publisher accounts · Enroll publisher accounts into developer programs · Assign roles for seller account"_; _"Manage all offer types"_; also unlocks the **Earnings** workspace                                                             | Yes              |
| **Developer**            | _"Upload packages / Submit offers"_; _"Marketplace insights"_                                                                                                                                                                                        | Yes              |
| **Business Contributor** | _"Set and update offer pricing"_; Earnings                                                                                                                                                                                                           | No               |
| **Finance Contributor**  | _"Manage payout and tax information"_; Earnings                                                                                                                                                                                                      | No               |
| **Marketer**             | _"Respond to customer reviews"_; non-financial insights                                                                                                                                                                                              | No               |

Invitations: [Add and manage users](https://learn.microsoft.com/en-us/partner-center/account-settings/add-manage-users)
(`ms.date` 2024-11-18, `updated_at` 2026-04-30) — _"To invite users that aren't currently a
part of your company work account (Microsoft Entra tenant) via email, you must have an
account with Global administrator permissions."_ Use **Add user → Invite outside users** (up
to 10 addresses); _"A new guest-user account is created in your work account (Microsoft Entra
tenant)."_ That satisfies the hard membership rule from
[Manage your Microsoft Marketplace account](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/manage-account-settings-and-profile):
_"all Partner Center users (including groups and Microsoft Entra applications) must have an
active work account in an Microsoft Entra tenant that's associated with your Partner Center
account."_

**Recommendation: give Caesar engineers `Developer`** — it grants exactly _"Upload packages /
Submit offers"_ plus Insights, and reaches neither Account Settings nor Earnings. Promote at
most one person to `Manager`, noting that `Manager` also exposes Earnings. Keep `Owner` with
Yivi B.V.

**Tenant association is the alternative and is worse here.**
[Manage tenants](https://learn.microsoft.com/en-us/partner-center/account-settings/manage-tenants)
(`ms.date` 2024-11-25, `updated_at` 2025-09-25; _Appropriate roles: Manager_) allows linking
additional tenants — _"This association would allow you to add and manage users from the
additional tenants on your Microsoft Marketplace account."_ But it is framed for _"if your
**company** has multiple tenants"_, it has a much larger blast radius, and it changes nothing
about ownership. If Caesar and Yivi already share one Entra tenant, none of this is needed at
all and it reduces to plain role assignment.

**PartnerID is bound to one entity and cannot be re-pointed.** Both
[create-account](https://learn.microsoft.com/en-us/partner-center/account-settings/create-account)
and [open-a-developer-account](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/open-a-developer-account)
warn: _"If you already have a PartnerID associated with this publisher account, you won't be
able to edit it."_ MPN is now the **Microsoft AI Cloud Partner Program (MAICPP)** and the MPN
ID is now the **PartnerID** — _"Choose the PartnerID [formerly Microsoft Partner Network (MPN)
ID] that you want to associate with the publisher."_

---

## 5. What must the publisher attest about branding rights, and what proof can Microsoft demand?

**It is a self-attestation you must be able to back up, not a document you file.** Nobody
will ask for a trademark certificate at submission — but the warranties you sign are broad,
and the liability for getting them wrong is entirely yours.

### What Microsoft actually verifies before you can publish

The five checks in
[understand-the-verification-process](https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process)
demand: a business email, a government-issued identity document, domain documentation from an
authorized registrar, and formation/registration documents. **No trademark registration, no
brand-use permission, and no licence document appears anywhere in that list.** The
[MPA FAQ](https://learn.microsoft.com/en-us/legal/marketplace/mpa-faq) (`ms.date` 2024-04-04)
confirms the scope: _"This is a behind-the-scenes process in which Microsoft verifies such
things as business address, email (domain) ownership and contact information."_

### What you nevertheless warrant

[Microsoft Publisher Agreement v8.0](https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement),
effective 2026-07-01. "**Offer Assets**" is defined (§12) to include _"the Offer name, Offer
descriptions, and any titles, images, screenshots, video trailers, user generated content, or
other materials you provide to Microsoft in connection with your Offer, **including any
trademarks, trade dress, or source identifiers contained therein**."_ So the name itself is an
Offer Asset. Then:

- **§6(d)** — _"**You have obtained any and all consents, approvals or licenses (including
  written consents of third parties where applicable) required for you to make your Offer
  available in the Microsoft Marketplace**…"_
- **§6(e)** — _"the information you provide to Microsoft under or in connection with this
  Agreement is true, accurate, current, and complete."_
- **§3(b)** — _"**Your Offer and Offer Assets must not infringe or misappropriate any
  intellectual property or personal right of any third party.** … You are, at your sole cost
  and expense, responsible for securing, reporting, and maintaining all necessary rights,
  clearances, and consents…"_
- **§3(c)** — the marketing licence to Microsoft, containing an embedded ownership
  representation: _"**You are the sole owner of your entity name, Offer Assets, and associated
  goodwill**, and the sole beneficiary of the goodwill associated with Microsoft's use of your
  entity name and Offer Assets."_
- **§9(d)(i)** — you indemnify Microsoft against _"any and all third party claims … alleging
  that your Offer or Offer Assets, infringe any proprietary or personal right of a third
  party"_.
- **§2(f)(iii)** — Microsoft may remove a listing on _"an assertion or claim that your Offer
  infringes the intellectual property rights of a third party, in accordance with our Notice
  and Takedown process for services"_.
- **§2(c)** — and certification buys you nothing as a defence: _"**Microsoft's Certification
  of an Offer does not constitute any representation or acknowledgment by Microsoft that the
  Offer complies with such requirements**…"_

The certification policies add **100.7 Accurate source** (quoted in §1 above), which requires
offer content and metadata to be _"originally created by the offer provider, appropriately
licensed from the third-party rights holder, used as permitted by the rights holder, or used
as otherwise permitted by law."_ Note that this clause **explicitly contemplates a licence** —
it does not require ownership.

### Microsoft knows how to demand written authorization, and does so elsewhere

This is the contrast that settles the question. Certification policy **1000.5 Microsoft 365
App and Add-In Linking**:

> "You must be the publisher of both the SaaS offer and the app or add-in(s), or
> **You must provide written authorization from the publisher of the SaaS offer or app or
> add-in to which you are trying to link your offer.**"

Microsoft demands a written third-party authorization explicitly, up front, where it wants
one — for cross-publisher offer linking. It does **not** do so for the provider/developer
name or for branding generally. That asymmetry is the strongest available evidence that
brand-rights proof is not collected at submission.

**Conclusion: written permission from the brand owner is a document we must _hold_, not a
document we must _file_.** A green certification is worth nothing as a defence (§2(c)), and
the entire cost of an IP claim falls on the publisher (§9(d)(i)).

### 5a. If the listing ships as "Yivi" — a licensed mark, not an owned one

This fallback has a **specific and non-obvious problem**. Per
[yivi.app/en/about_yivi/](https://yivi.app/en/about_yivi/), verbatim:

> "The trademark rights of Yivi belong to the Privacy by Design Foundation, an independent
> Dutch non-profit foundation. **The foundation has a contract with Caesar Groep to use the
> Yivi brand name** for further development and management."

Two things follow. First, Yivi B.V. would be listing under a mark it **licenses rather than
owns**, which sits awkwardly against MPA **§3(c)**'s _"You are the sole owner of your entity
name, Offer Assets, and associated goodwill."_ Policy 100.7 is satisfied by a licence, but
§3(c) is phrased as ownership. Second — and this is the sharper point — the brand-use
contract named on that page is with **Caesar Groep**, not with **Yivi B.V.**, while the
entity whose name the mark is would be Yivi B.V. Whether the licence flows down to the
subsidiary is not something a public page can answer.

**So "Yivi" is not the safe fallback it looks like.** It needs the same written-permission
work as "PostGuard", plus confirmation that the licence reaches the entity actually
publishing. If a fallback is wanted that avoids the brand-rights question entirely, the
publisher-name candidate with the cleanest attestation is the **legal entity's own name**,
which §3(c) is written for.

### 5b. If the listing ships as "PostGuard" — ownership is unestablished

Nobody has established who owns the **PostGuard** mark, and the ticket's assumption that
Yivi holds it is not corroborated by any public source I could find. The lineage argues for
caution rather than comfort: PostGuard originated at **iHub, Radboud University**, developed
_"with support from NWO and SIDN fonds"_ (postguard.eu/privacy), and the sibling mark from
that same lineage — Yivi, formerly IRMA — ended up with **Stichting Privacy by Design**
rather than with the operating company. The same pattern would put PostGuard's mark with the
foundation or with Radboud/NWO rather than with Yivi B.V.

Reinforcing the concern, the PostGuard privacy policy still attributes the _service itself_
to Radboud University (see §7 below), which is not what you would expect if the operating
company had taken the brand across.

**This is a blocking unknown that a human must resolve before anyone signs the MPA**, because
§6(d) and §3(c) are attestations about exactly this. It is cheap to resolve — one question to
Yivi's legal contact and, if needed, a written licence from the rights holder — and expensive
to get wrong, since §9(d)(i) makes the publisher carry the full cost of a claim.

---

## 6. Can the publisher display name be changed after the listing is live?

**Yes, the field itself is self-service and editable at any time. But changing it after
go-live drags the manifest with it, and that does force re-certification.**

### The field is editable; the identifiers are not

[Manage a Microsoft Marketplace account in Partner Center](https://learn.microsoft.com/en-us/partner-center/account-settings/manage-account)
(`ms.date` 2024-05-23, `updated_at` 2025-09-25) documents the account settings layout, and
the layout is itself the answer to question 1. **Legal info** is the default view and holds
_"All the legal business information such as registered legal name and address for your
company."_ The **Developer** tab separately holds:

> "Publisher IDs: Seller ID, User ID, Publisher ID, Microsoft Entra tenants, and more
>
> Contact info: Publisher display name, seller contact (name, email, phone, and address) and
> Company approver (name, email, phone)"

Two different sections, two different lifecycles:

> "In the Publisher IDs section, you can see your Symantec ID (if applicable), Seller ID,
> User ID, MPN ID, and Microsoft Entra tenants. Microsoft assigns these values to uniquely
> identify your developer account and **can't be edited**."
>
> "**You can also select the Update link to change your contact info, such as publisher
> display name and email address.**"

The same split appears in the marketplace-publisher version of the page,
[Manage your Microsoft Marketplace account](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/manage-account-settings-and-profile)
(`ms.date` 2025-07-02, `updated_at` 2025-09-25): _"Contact info, including Publisher display
name, Seller contact name, email, phone, and address"_, against _"In the Publisher IDs
section, you can see your Seller ID and User ID. These values are assigned by Microsoft to
uniquely identify your developer account and can't be edited."_

So: **Publisher display name — editable via an Update link. Seller ID / User ID / Publisher
ID / MPN ID — permanently fixed.** And per the Add-publisher form (§1), `PublisherID` is a
slug constrained to lower-case letters, numbers, `-` and `_`, and _"can't be reused"_.

### Contrast: the legal name is not self-service

Changing the _legal_ name is deliberately harder, which is the clearest confirmation that
Microsoft treats the two as different things. From
[Verify your company profile](https://learn.microsoft.com/en-us/partner-center/account-settings/update-your-partner-profile)
(`ms.date` 2025-06-04, `updated_at` **2026-06-25**):

> "Direct-bill partners and Indirect providers can't change the legal name of their company
> if the account verification status is Authorized. If you need to change the name, you must
> create a support request."

(That sentence is scoped to CSP partners, so it is indicative rather than binding on a
marketplace-only account — but the direction of travel is unambiguous.)

### Does a change force re-certification?

**Not by itself — but in practice yes, because of the ProviderName coupling.** No Microsoft
page states that editing the publisher display name triggers offer re-certification. The
re-certification rule is scoped to the _submission_
([submit-to-appsource-via-partner-center](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center)):

> "If you make changes after your submission is certified, it must go through the
> certification process again."

The coupling is the checklist rule from §2: _"For Office Add-ins, the provider/developer name
in the manifest must match the Publisher."_ Change the Publisher name after go-live and the
live manifest's `<ProviderName>` no longer matches it. Restoring compliance means editing
`manifest.xml`, which means a new package, which means a new submission — and therefore a
fresh 3–5 working-day certification pass.

> **Marked as inference, not a Microsoft statement.** Microsoft does not anywhere say "a
> publisher-name change requires re-certification". This conclusion is composed from two
> primary rules (the checklist's must-match requirement plus the changes-require-
> re-certification rule). Treat it as sound but derived. What is _not_ derived, and is
> stated outright, is that the display-name field itself is editable without a support
> ticket.

**Practical consequence: pick the name before first submission.** It is cheap now and costs
a full re-certification cycle later. This is also the argument for resolving the trademark
question (§5b) _before_ submitting rather than shipping under one name and renaming.

---

## 7. The privacy-policy coherence problem — which is real, but not a certification blocker

The ticket's stated worry is _"a listing published by one company but pointing at a privacy
policy naming another."_ That worry is well founded, but the actual situation is different
from the one described, and the certification consequences are milder than expected.

### What the privacy policy says today

**The PostGuard privacy policy does not name Yivi.** Retrieved from
[postguard.eu/privacy](https://postguard.eu/privacy/) on 2026-08-18 (page states _"Last
updated: April 21, 2026"_), verbatim:

> "PostGuard is operated by the iHub team at Radboud University (RU) in The Netherlands."
>
> "As explained in more detail below, iHub/RU is the data controller, in the sense of
> Europe's General Data Protection Regulation (GDPR): it determines the purposes and means."

It further names **ProcoliX** as a joint processor for file sharing, gives no KvK number and
no postal address, and offers only `info@postguard.eu` as contact. The only mention of the
group anywhere on the page is the site footer: _"Built by Yivi @ Caesar Groep"_.

I re-checked this twice against the live page on 2026-08-18, including a targeted search for
"Yivi B.V." and for any alternative controller statement, and found none. **The briefing I
was given states that this policy names Yivi as the GDPR data controller; as of today it does
not.** Flagging rather than silently reconciling, because it changes the checklist: the gap
is not "align the listing with the privacy policy" but "decide who the controller actually
is, then align both."

So there are **four** entities in play, not two: Yivi B.V. (proposed publisher), Caesar Groep
Rotterdam B.V. (parent, engineering, holds the Yivi brand licence), Stichting Privacy by
Design (owns the Yivi mark), and iHub / Radboud University (named operator and controller of
PostGuard itself).

### What certification actually requires of the privacy policy

Less than you would hope, and notably **not** that it name the publisher. From the
[publishing checklist](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/checklist),
Step 6, verbatim — the required contents are:

> - "Information on your policies regarding users' personal information. That is, how users'
>   personal information is handled.
> - A reference to the app OR your service overall, not only your website.
> - **A description of your service that includes the name of the app you're submitting.**
> - A valid link that doesn't generate a 404 error."
>
> "If your privacy policy is missing any of the preceding items, it will fail validation and
> require resubmission."

Plus certification policy **100.6**: _"Your listing must include a link to your privacy
policy for the listed offer"_, and **100.5**, which says the policy _"Should detail any of
your applicable collection, use, and storage of customer data."_

Measured against that list, the current policy **passes**: it names PostGuard throughout,
describes the service in detail, and resolves. The possessive in _"**your** privacy policy"_
carries an implication of authorship, but no clause anywhere requires the document to name
the publishing legal entity, and none requires controller and publisher to be the same party.

> **Assessment: the publisher/controller mismatch is a trust and GDPR-accuracy problem, not
> a documented certification failure.** It should be fixed, but it should not be modelled as
> a launch blocker, and it should not be the reason a name is chosen.

### Two gaps that _are_ documented failure modes

- **No EULA.** Step 6 requires _"an https:// URL for your EULA policy"_ alongside support and
  privacy URLs, and warns: _"One of the top reasons an app submission fails our validation
  process is when these links aren't included in submission."_ PostGuard has no published
  EULA. Microsoft supplies a usable standard one at
  <https://support.office.com/client/61994a3b-2c87-41c4-a88d-a6455efa362d>, and the checklist
  explicitly sanctions using it _"if you don't already have one and have consulted with your
  legal counsel."_ Cheapest possible fix.
- **Terms of Use is not a privacy policy.** _"A Terms of Use policy isn't considered a privacy
  policy. You must include a privacy policy that's separate from your Terms of Use policy."_
  Keep them as two distinct URLs.

Also note the manifest currently points `<SupportUrl>` at `https://postguard.eu`, the site
root. The requirement is a support page — _"Provide a URL so customers who have issues with
your app can contact your company for support"_ and _"This can't be an email address; it must
be an https:// URL."_ A bare homepage is a weak answer to that and is worth pointing at a
real support or contact page before submission.

---

## What Yivi B.V. must produce

Ordered by lead time — the first two are the long poles and should start immediately.

### A. Decide before anything else (blocking, no Microsoft involvement)

1. **Who owns the "PostGuard" trademark.** Unestablished (§5b). If it is not Yivi B.V., a
   **written licence or brand-use permission** from the actual owner, naming Yivi B.V. as
   permitted user, held on file before the MPA is signed. This backs MPA §6(d) and §3(c).
2. **Whether the Yivi brand licence reaches Yivi B.V.** The published contract is between
   Stichting Privacy by Design and _Caesar Groep_ (§5a). Only relevant if "Yivi" is used as
   the fallback publisher name — but it must be settled before that fallback is relied on.
3. **Who the GDPR controller for PostGuard is**, given the policy currently says iHub /
   Radboud University (§7). Then update `postguard.eu/privacy` to match reality.

### B. Documents for account verification

4. **Company registration extract for Yivi B.V.** — a KvK _uittreksel_.
   Must be **issued within the last 12 months**; if it carries an expiry, valid **≥2 months
   beyond** submission; and the PDF must **display the KvK site/link**, since Microsoft's
   accepted categories are _"extract from commercial register (site/link must be displayed)"_
   and _"record on a Government registry website (site/link must be displayed)"_.
   **Not accepted: self-written documents, screenshots, or unofficial materials.**
5. **Exact legal name string** as recorded at the KvK, including the `B.V.` suffix, with no
   abbreviation or spelling drift — name mismatch is the single most-cited rejection cause.
6. **Registered address** matching the extract (Utrecht per yivi.app).
7. **The KvK number** — optional for NL (not on Microsoft's mandatory-registration-ID
   list), but supply it; it accelerates the automated check. Never a personal ID.
8. _(Contingency)_ **Domain documentation** for whichever domain goes in the registration
   form — from an authorized registrar, showing business name, address, domain and
   purchase/expiry dates. Only requested if the automated website/email domain match fails.

### C. People

9. **A named primary contact at Yivi B.V.** with an **individual work email on the company's
   own domain**. Not a group alias, not `info@`, not a free provider, and **no plus-addressing**
   — an OTP is sent to it.
10. **That person's government-issued photo ID** (passport, driving licence, or identity
    card), unexpired, with the name **matching the Partner Center account exactly and in the
    same language**, plus a mobile device running **Microsoft Authenticator** for the verified
    credential. Only the primary contact can do this step, and it must be completed **within
    30 days** of the request. Creating the credential is not enough — they must return to
    Partner Center and present it via QR scan.
11. **Someone with authority to sign the MPA** on behalf of Yivi B.V. (_"You must have
    authority to sign legal agreements on your company's behalf"_), and a **Company approver**
    contact.
12. **A Microsoft Entra work account** in the tenant that will hold the Partner Center
    account. For Caesar staff: **Global administrator** on that tenant to send guest invites,
    then assign Caesar engineers the **Developer** role (guest-assignable; grants upload and
    submit) and at most one **Manager**. Keep **Owner** with Yivi B.V.

### D. Listing assets

13. **Publisher name set to `PostGuard`** on the publisher record — this is the field that
    makes the existing `<ProviderName>PostGuard</ProviderName>` compliant. Set it before
    first submission (§6).
14. **A privacy policy URL** that names the app, describes the service, and is separate from
    the terms of use. Currently satisfied on paper; see item 3 for the accuracy problem.
15. **A EULA URL** — none exists today. Microsoft's standard EULA is acceptable.
16. **A real support URL**, not the site root.
17. **Certification notes**: test account, Yivi disclosure walkthrough, and a line pre-empting
    policy 1100.7 explaining that "PostGuard" is the product's own name rather than a company
    brand inserted into the title.
18. **Icons** (high-resolution mandatory), **at least one screenshot**, short and long
    descriptions, and an app name _"the same or very similar to"_ the manifest's `DisplayName`.

### What Yivi does _not_ need

No payout or tax profile, no bank details, no W-8BEN — free offers only. No trademark
certificate filed with Microsoft. No DNS TXT record for `postguard.eu`. No phone callback.
No MPN/PartnerID pre-existing enrolment for the listing itself (`mpnId` is optional; a
PartnerID is required only for Entra publisher verification, which is a separate programme).

---

## Realistic timeline

| Phase                                       | Elapsed                  | Notes                                                                                   |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Gather documents, settle trademark question | **1–3 weeks**            | Entirely on us; the trademark answer is the long pole and is not a Microsoft dependency |
| Account creation + MPA acceptance           | same day                 |                                                                                         |
| Identity verification                       | ~15 min effort           | 30-day deadline; single-person bottleneck                                               |
| Account verification (all five checks)      | **3–5 business days**    | Microsoft's own figure, stated on two independent pages                                 |
| — if a check falls to manual review         | +2–5 business days       |                                                                                         |
| — if business/domain check needs documents  | _"significantly longer"_ | up to 3 appeals, **no published SLA**                                                   |
| First submission → certification verdict    | **3–5 working days**     |                                                                                         |
| Realistic total, first submission to live   | **up to 4 weeks**        | Microsoft's own figure, and it warns first-time submissions are _commonly_ rejected     |
| Certification → visible in Marketplace      | ~1 hour                  |                                                                                         |

**Plan on ~1 week to a verified account with clean documents, and 4–6 weeks from starting the
submission to a live listing.** The dominant risks are not the naming question at all: they
are (a) a rejected business-verification document, where appeals have no SLA, and (b) the
first-submission rejection Microsoft explicitly says is common.

---

## What I could not establish

1. **Who owns the "PostGuard" trademark, or whether one is registered at all.** The decisive
   open question. I attempted the TMview aggregate register API (`tmdn.org/tmview`) for both
   `PostGuard` and `Yivi` across EM/BX/NL offices on 2026-08-18; the endpoint returned empty
   bodies under scripted access. **BOIP (`boip.int`) and EUIPO eSearch were not successfully
   queried in this pass.** Ownership therefore rests on no register evidence whatsoever.
   Needs a human with a browser, or Yivi's own IP counsel — who will simply know.
2. **Whether Yivi B.V. and Caesar Groep share one Microsoft Entra tenant.** This determines
   whether guest invitations are needed at all or whether the whole access question collapses
   into ordinary role assignment. Internal fact; nobody outside can answer it.
3. **Whether Microsoft accepts a KvK extract by that name.** Microsoft never writes "KvK" or
   "Kamer van Koophandel" on any page I found. The inference that a KvK _uittreksel_ satisfies
   _"extract from commercial register"_ / _"record on a Government registry website"_ is
   strong and category-based, but it is an inference, not a Microsoft statement.
4. **Whether the Stichting Privacy by Design → Caesar Groep brand licence flows down to Yivi
   B.V.** The public page names Caesar Groep as the contracting party (§5a). The contract
   itself is not public.
5. **Observed AppSource/Marketplace precedent.** I could not confirm by direct observation
   that live listings show brand-style publisher names rather than legal entities —
   `appsource.microsoft.com` and `marketplace.microsoft.com` both returned **HTTP 403** to
   scripted access on 2026-08-18. The documentary case in §1 stands on its own (the field is
   literally defined as the customer-facing display name), but the empirical confirmation is
   missing. Cheap to check in a browser.
6. **The certification policies' true version.** The live page renders _"Document version:
   1.67"_, while its own
   [change history](https://learn.microsoft.com/en-us/legal/marketplace/offer-policies-change-history)
   lists releases through **v1.94, dated 2026-07-24** (v1.91, 2026-05-04, _"Updated 1120.1,
   1120.3, 1120.4 and 1120.5.3"_ — i.e. our Office Add-ins section was amended in May 2026).
   The version string on the policy page is stale relative to its own changelog. I read the
   live text, so the quotations are current; the version number attached to them is not
   trustworthy.
7. **Whether a publisher display-name change alone triggers re-certification.** Microsoft is
   silent. §6's conclusion is composed from two separate primary rules and is flagged there
   as inference.
8. **`ProviderName`'s reference page is four years stale** (`updated_at` 2022-06-30) and
   predates both the unified manifest and the Marketplace rename. The binding rule is the
   2025-dated publishing checklist, not the schema reference.
9. **Nothing here was confirmed against a live Partner Center account.** Every claim is from
   documentation. The Add-publisher form's real-world validation behaviour on the Publisher
   name field — whether it silently accepts anything, or warns on a mismatch with the legal
   entity — can only be established by someone logged in.
