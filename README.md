# <p align="center"><img src="./img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/postguard-js).

TypeScript/JavaScript SDK for PostGuard, published as `@e4a/pg-js` on npm. Works in both browsers and Node.js.

PostGuard encrypts data for recipients based on their identity attributes (email address, phone number, etc.) rather than traditional public keys. Recipients prove their identity via [Yivi](https://yivi.app) to decrypt. This SDK is the main way web applications and email add-ons integrate with PostGuard.

## Quick Start

```bash
npm install @e4a/pg-js
```

```ts
import { PostGuard } from '@e4a/pg-js';

const pg = new PostGuard({
  pkgUrl: 'https://pkg.postguard.eu',
});

// Encrypt
const sealed = pg.encrypt({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [pg.recipient.email('bob@example.com')],
  files: fileList,
});
const { uuid } = await sealed.upload();

// Decrypt
const opened = pg.open({ uuid });
const result = await opened.decrypt({ element: '#yivi-popup' });
result.download();
```

See the [full API reference](https://docs.postguard.eu/repos/postguard-js) for encryption options, signing methods, recipient types, and email helpers.

## Server-side usage (Node, Bun, Deno)

The SDK works in non-browser runtimes for the encrypt + upload path
when signing via `sign.apiKey` or a custom `sign.session` callback. No
polyfills required.

**Minimum runtime versions**:

| Runtime | Minimum | Notes                                                                                       |
| ------- | ------- | ------------------------------------------------------------------------------------------- |
| Node    | 22+     | Enforced via `engines.node`. The build tool requires Node 22.18+; runtime is tested on 22 and 24. |
| Bun     | 1.0.16+ | First release with `AbortSignal.any` (the SDK's tightest web-API requirement)               |
| Deno    | 1.39+   | First release with `AbortSignal.any`                                                        |

Other notes:

- `sign.yivi(...)` requires a DOM and is browser-only. The SDK throws a
  clear `YiviSessionError` upfront on non-browser runtimes — use
  `sign.apiKey` or `sign.session` instead.
- For decryption, `result.blob` and `result.plaintext` are universal;
  `result.download(...)` triggers a browser download and is browser-only.
- `sealed.upload()` refuses `data: ReadableStream` — use
  `sealed.toBytes()` for streaming, or pass `data` as `Uint8Array`.

A manual smoke test for any runtime lives at `scripts/smoke.mjs`. Set
`PG_API_KEY` to a staging key to exercise the full upload pipeline:

```bash
PG_API_KEY=PG-... node scripts/smoke.mjs
PG_API_KEY=PG-... bun  scripts/smoke.mjs
PG_API_KEY=PG-... deno run -A scripts/smoke.mjs
```

## Development

Install dependencies and build:

```bash
npm install
npm run prebuild
npm run build
```

Run the tests:

```bash
npm run test
```

## Releasing

Releases are handled by [semantic-release](https://semantic-release.gitbook.io/) on the `main` branch. When commits land on `main`, semantic-release determines the next version from conventional commit messages and publishes to npm automatically.

## License

MIT
