# @e4a/pg-js

TypeScript/JavaScript SDK for [PostGuard](https://postguard.eu) — end-to-end encrypted file sharing using identity-based encryption (IBE) and [Yivi](https://yivi.app).

## Installation

```bash
npm install @e4a/pg-js
```

> **Peer dependencies:** `@privacybydesign/yivi-core`, `@privacybydesign/yivi-client`, `@privacybydesign/yivi-web`

## Supported flows

| Flow | Description |
|------|-------------|
| Yivi → Yivi | Sender signs with their Yivi identity; recipient decrypts using Yivi. Fully peer-to-peer. |
| API → Yivi (with email delivery) | Business signs with an API key; Cryptify sends email notification to recipient. |
| API → Yivi (without email delivery) | Business signs with an API key; upload returns a UUID for custom delivery. |

## Usage

### Setup

```ts
import { PostGuard } from '@e4a/pg-js';

const pg = new PostGuard({
  pkgUrl: 'https://pkg.staging.yivi.app',
  cryptifyUrl: 'https://fileshare.staging.yivi.app',
});
```

### Yivi → Yivi (peer-to-peer)

The sender signs using their own Yivi identity. The recipient decrypts via a Yivi session.

```ts
const result = await pg.encryptAndUpload({
  sign: pg.sign.yivi({
    element: '#yivi-popup',
    senderEmail: 'alice@example.com',
  }),
  recipients: [pg.recipient.email('bob@example.com')],
  files: fileList,
});

console.log(result.uuid); // share this UUID with the recipient
```

### API → Yivi with email delivery

The business signs with an API key. Cryptify automatically sends an email to the recipient.

```ts
const result = await pg.encryptAndDeliver({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [pg.recipient.email('bob@example.com')],
  files: fileList,
  delivery: {
    message: 'Here are your documents.',
    language: 'EN',
    confirmToSender: true,
  },
});
```

### API → Yivi without email delivery

Upload only — receive a UUID and handle delivery yourself.

```ts
const result = await pg.encryptAndUpload({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [
    pg.recipient.email('bob@example.com'),
    pg.recipient.emailDomain('example-org.com'),
  ],
  files: fileList,
  onProgress: (pct) => console.log(`${pct}% uploaded`),
});
```

### Decryption (always via Yivi)

```ts
const result = await pg.decrypt({
  uuid: 'the-file-uuid',
  element: '#yivi-popup',
  recipient: 'bob@example.com', // optional hint
});

result.download('decrypted-files.zip');
console.log('Sender:', result.sender);
```

## Error handling

```ts
import { PostGuardError, NetworkError, YiviNotInstalledError, DecryptionError } from '@e4a/pg-js';

try {
  await pg.encryptAndUpload(options);
} catch (err) {
  if (err instanceof YiviNotInstalledError) {
    // prompt user to install Yivi app
  } else if (err instanceof NetworkError) {
    // handle connectivity issues
  } else if (err instanceof PostGuardError) {
    // generic SDK error
  }
}
```

## License

MIT
