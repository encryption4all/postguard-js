# pg-sveltekit: PostGuard SvelteKit example

> Part of the `postguard-js` pnpm workspace. Run `pnpm install` **once from the repository root** — `npm install` here will not work, because this package depends on `@e4a/pg-js` as `workspace:*` and npm cannot resolve that protocol. The commands below are written to run from the repo root.

Example SvelteKit web app demonstrating how to use the [@e4a/pg-js](https://www.npmjs.com/package/@e4a/pg-js) SDK for the **Informatierijk notificeren** use case.

## What it does

A single-page app with two delivery modes:

1. **Encrypt & Send**: encrypts files for a citizen (exact email) and an organisation (email domain), uploads to Cryptify, and sends an email notification to the recipients.
2. **Encrypt & Upload**: same encryption and upload, but returns a UUID so you can distribute the download link yourself.

## Prerequisites

- Node.js 22+
- A PostGuard API key

## Setup

1. **Install dependencies**:

   ```bash
   pnpm install   # from the repo root
   ```

2. **Configure environment variables**:

   ```bash
   cp examples/pg-sveltekit/.env.example examples/pg-sveltekit/.env
   ```

   Available variables (see `.env.example`):

   | Variable              | Description                                | Default                                                                         |
   | --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
   | `PUBLIC_PKG_URL`      | PostGuard PKG server URL                   | `https://pkg.staging.postguard.eu`                                              |
   | `PUBLIC_CRYPTIFY_URL` | Cryptify file-sharing URL                  | `https://storage.staging.postguard.eu`                                          |
   | `PUBLIC_DOWNLOAD_URL` | PostGuard website used in `/download` URLs | `https://staging.postguard.eu` on staging Cryptify, else `https://postguard.eu` |
   | `PUBLIC_APP_NAME`     | App display name                           | `PostGuard for Business Example`                                                |

## Run

```bash
pnpm --filter pg-sveltekit dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Staging Cryptify does not send email

The default `PUBLIC_CRYPTIFY_URL` is `storage.staging.postguard.eu` — the staging
deployment. It **does not actually deliver notification emails**, so you can exercise
the full upload + notify flow without spamming real inboxes while you integrate the SDK.

What this means for the example:

- The upload itself works. You get back a real UUID and the download URL is usable.
- The **Encrypt & Send** flow succeeds, but no email is sent to the recipient. The UI
  will surface a banner and show the download URL — open it yourself to verify the
  decrypt flow end-to-end.
- Point `PUBLIC_CRYPTIFY_URL` at the production Cryptify host to exercise real email
  delivery.

## Build

```bash
pnpm --filter pg-sveltekit build
pnpm --filter pg-sveltekit preview   # preview the production build
```
