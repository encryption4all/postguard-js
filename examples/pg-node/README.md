# pg-node: PostGuard Node.js example

> Part of the `postguard-js` pnpm workspace. Run `pnpm install` **once from the repository root** — `npm install` here will not work, because this package depends on `@e4a/pg-js` as `workspace:*` and npm cannot resolve that protocol. The commands below are written to run from the repo root.

Node.js example demonstrating how to use the [@e4a/pg-js](https://www.npmjs.com/package/@e4a/pg-js) SDK from a server runtime. Mirrors the [pg-sveltekit](../pg-sveltekit) example's "Informatierijk notificeren" flow (citizen + organisation recipients) as a CLI script. Drop-in starting point for backend integrations.

## What it does

Two modes, selected by the script you run:

| Mode        | Command          | What it does                                                                                                                                              |
| ----------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Send        | `pnpm --filter pg-node send`   | Encrypts the input files for a citizen (exact email) and an organisation (email domain), uploads to Cryptify, and asks Cryptify to email each recipient. |
| Upload-only | `pnpm --filter pg-node upload` | Same encryption and upload, but silent. Cryptify returns a UUID you can distribute through some other channel.                                            |

Files come from `PG_INPUT_FILES` (comma-separated paths), or two in-memory demo files if that is unset.

## Prerequisites

- **Node.js 22+**, matching `@e4a/pg-js`'s `engines.node`. The SDK also supports Bun and Deno; the same encryption code in `src/encryption.mjs` works there too.
- A PostGuard for Business API key.

## Setup

```bash
cp examples/pg-node/.env.example examples/pg-node/.env
# edit that .env: set at minimum PG_API_KEY
```

The `package.json` depends on `@e4a/pg-js` as `workspace:*` — the copy in `packages/pg-js`, built from source, not a published release. So this example is always exercised against the SDK as it currently stands, which is what keeps it from documenting an API that no longer exists.

## Run

```bash
pnpm --filter pg-node send       # encrypt + upload + ask Cryptify to send mails
pnpm --filter pg-node upload     # encrypt + upload silently, no mails
```

The script prints the resulting `uuid` and the corresponding `…/download?uuid=…` URL.

## Staging Cryptify does not send email

The default `PG_CRYPTIFY_URL` is `storage.staging.postguard.eu`, the staging deployment. It **does not actually deliver notification emails**, so you can exercise the full upload + notify flow without spamming real inboxes while you integrate.

- The upload itself works. You get back a real UUID and the download URL is usable.
- `pnpm --filter pg-node send` succeeds, but no recipient mail is sent. Open the printed URL yourself to verify the decrypt flow end-to-end.
- Point `PG_CRYPTIFY_URL` at the production Cryptify host to exercise real email delivery.

## Configuration

| Variable                | Description                                           | Default                                                                            |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PG_API_KEY`            | PostGuard for Business API key (`PG-…`)               | *(required)*                                                                       |
| `PG_PKG_URL`            | PostGuard PKG server URL                              | `https://pkg.staging.postguard.eu`                                                 |
| `PG_CRYPTIFY_URL`       | Cryptify file-sharing URL                             | `https://storage.staging.postguard.eu`                                             |
| `PG_DOWNLOAD_URL`       | PostGuard website used in `/download` URLs            | `https://staging.postguard.eu` on staging Cryptify, else `https://postguard.eu`    |
| `PG_CITIZEN_EMAIL`      | Citizen recipient (exact email match)                 | `citizen@example.com`                                                              |
| `PG_ORGANISATION_EMAIL` | Organisation recipient (matches by domain)            | `noreply@example.org`                                                              |
| `PG_MESSAGE`            | Optional unencrypted body for Cryptify's notify mail  | *(empty)*                                                                          |
| `PG_INPUT_FILES`        | Comma-separated file paths to encrypt                 | two in-memory demo files                                                           |

## How it maps to the SDK

The work happens in [`src/encryption.mjs`](./src/encryption.mjs):

```js
const sealed = pg.encrypt({
  files,
  recipients: [pg.recipient.email(citizen.email), pg.recipient.emailDomain(organisation.email)],
  sign: pg.sign.apiKey(apiKey),
  onProgress,
  signal,
});
const { uuid } = await sealed.upload({ notify: { recipients: true, message, language: 'EN' } });
```

`notify` must be nested under an object, and **nothing checks that at runtime** — `{ notify: true }` fails silently and is worse than omitting `notify` altogether:

- reading `.recipients` off the boolean `true` yields `undefined`, so `false` goes on the wire and no mail is sent;
- and because `notify` *is* defined, the SDK's silent-upload notice does not fire either, so there is no warning.

There was once a runtime validator, but it hand-maintained an allowlist of upload keys and rejected valid options when the types moved ahead of it; `packages/pg-js/tests/postguard.test.ts` pins its removal. Passing `{ notify: { recipients: false } }` when you mean silence is the way to be explicit. See the [SDK README](https://github.com/encryption4all/postguard-js#server-side-usage-node-bun-deno) for the full server-side surface.
