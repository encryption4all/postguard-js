# pg-manual: PostGuard low-level WASM example

> Part of the `postguard-js` pnpm workspace. Run `pnpm install` **once from the repository root** — `npm install` here will not work, because this package depends on `@e4a/pg-js` as `workspace:*` and npm cannot resolve that protocol. The commands below are written to run from the repo root.


Browser example that drives PostGuard encryption and decryption directly through the low-level [`@e4a/pg-wasm`](https://www.npmjs.com/package/@e4a/pg-wasm) library. Where [pg-sveltekit](../pg-sveltekit) and [pg-node](../pg-node) use the high-level [`@e4a/pg-js`](https://www.npmjs.com/package/@e4a/pg-js) SDK, pg-manual calls `seal`, `Unsealer`, `sealStream`, and `StreamUnsealer` itself and builds the policies, signing requests, and key fetches by hand. It is the only sub-project that talks to the WASM module and the PKG directly, so it is the one to read when you need policy-level control that the SDK does not expose.

## What it demonstrates

Two entry points, each a separate page:

| Page          | Source                                       | What it does                                                                                       |
| ------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `string.html` | [examples/string.js](./examples/string.js)   | Encrypts a text field in memory with `seal`, then decrypts it back with `Unsealer`.                |
| `file.html`   | [examples/file.js](./examples/file.js)       | Encrypts and decrypts a file as a stream with `sealStream` / `StreamUnsealer`, writing the result to disk via [streamsaver](https://www.npmjs.com/package/streamsaver). |

Both flows sign the ciphertext with a public policy (visible to everyone) and a private policy (visible only to recipients), encrypt for a recipient identified by an email attribute, and then fetch a user decryption key to read it back.

## How the key flow works

The example talks to a PostGuard Key Generator (PKG) and uses [Yivi](https://yivi.app) for authentication:

1. The master public key and signing verification key are fetched from the PKG (`/v2/parameters` and `/v2/sign/parameters`).
2. Retrieving a signing or decryption key starts a Yivi session. A popup appears with a QR code, and you disclose the requested attributes with the Yivi app on your phone.
3. The PKG returns the key once the disclosure is valid, and the WASM module seals or unseals the payload.

The session and key-request shapes live in [examples/utils.js](./examples/utils.js). That file also holds the `PKG_URL` constant that every fetch derives from.

## IRMA demo credentials

The example uses **IRMA demo credentials**, so no real personal data is involved. The policies reference demo attributes:

- `irma-demo.sidn-pbdf.email.email` for the recipient (`bob@example.com`)
- `irma-demo.gemeente.personalData.fullname` and `irma-demo.gemeente.personalData.bsn` for the sender's signature

Before running, load these demo credentials into your Yivi app. Anyone can issue an instance with custom data from the attribute index:

- https://privacybydesign.foundation/attribute-index/en/irma-demo.gemeente.personalData.html
- https://privacybydesign.foundation/attribute-index/en/irma-demo.sidn-pbdf.email.html

Because these are demo credentials, the Yivi popup issues them on the spot if you do not already hold them.

## Prerequisites

- Node.js and a browser.
- The [Yivi app](https://yivi.app) on your phone, with the demo credentials above.

## Run

```bash
pnpm --filter @e4a/pg-example dev
```

Webpack Dev Server serves the example at http://localhost:9000. The landing page links to `string.html` and `file.html`. Open one, encrypt, and follow the Yivi popup to fetch the key needed to decrypt.

## Configuration

`PKG_URL` in [examples/utils.js](./examples/utils.js) selects the PKG deployment. It currently points at the legacy Radboud iHub deployment (`https://main.postguard.ihub.ru.nl/pkg`) rather than the modern staging host used by the other sub-projects (see encryption4all/postguard-examples#54). Change that one constant to target a different PKG; the encryption, signing, and key-fetch calls all derive from it.

## When to use pg-manual

Reach for `@e4a/pg-wasm` directly when you need control the `@e4a/pg-js` SDK does not surface, such as custom policy construction, separate public and private signing policies, or direct access to the unsealer header. For most integrations the SDK used by [pg-sveltekit](../pg-sveltekit) and [pg-node](../pg-node) is the simpler starting point.

## License

MIT
