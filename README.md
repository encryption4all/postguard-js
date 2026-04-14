# postguard-js

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
