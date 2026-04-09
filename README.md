# @e4a/pg-js

TypeScript/JavaScript SDK for [PostGuard](https://postguard.eu) — end-to-end encrypted file sharing and messaging using identity-based encryption (IBE) and [Yivi](https://yivi.app).

PostGuard encrypts data for recipients based on their **identity attributes** (email, phone number, etc.) rather than traditional public keys. Recipients prove their identity via Yivi to decrypt. No key exchange or certificates required.

## Installation

```bash
npm install @e4a/pg-js
```

> **Peer dependencies (optional):** For Yivi web UI integration, install `@privacybydesign/yivi-core`, `@privacybydesign/yivi-client`, `@privacybydesign/yivi-web`. Not needed when using API key signing or custom session callbacks.

## Quick Start

```ts
import { PostGuard } from '@e4a/pg-js';

const pg = new PostGuard({
  pkgUrl: 'https://pkg.staging.yivi.app',
  cryptifyUrl: 'https://fileshare.staging.yivi.app', // optional, for file upload flows
  headers: { 'X-My-Client': 'v1.0' },                // optional
});
```

## Supported Flows

| Flow | Method | Description |
|------|--------|-------------|
| Yivi → Yivi | `encryptAndUpload` | Peer-to-peer: sender signs with Yivi, recipient decrypts with Yivi |
| API → Yivi (with email) | `encryptAndDeliver` | Business signs with API key, Cryptify sends email notification |
| API → Yivi (no email) | `encryptAndUpload` | Business signs with API key, returns UUID for custom delivery |
| Raw encrypt | `encrypt` | Encrypt raw data (for email addons, custom transports) |
| Raw decrypt | `decrypt({ data })` | Decrypt raw data (for email addons) |

## Encryption

### Encrypt files + upload to Cryptify

```ts
const { uuid } = await pg.encryptAndUpload({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [pg.recipient.email('bob@example.com')],
  files: fileList,
  onProgress: (pct) => console.log(`${pct}%`),
});
```

### Encrypt files + upload + email delivery

```ts
const { uuid } = await pg.encryptAndDeliver({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [pg.recipient.email('bob@example.com')],
  files: fileList,
  delivery: { message: 'Here are your documents.', language: 'EN' },
});
```

### Encrypt raw data (no upload)

For email clients and custom integrations that handle their own transport:

```ts
const encrypted = await pg.encrypt({
  sign: pg.sign.apiKey('your-api-key'),
  recipients: [pg.recipient.email('bob@example.com')],
  data: myDataBytes, // Uint8Array or ReadableStream
});
// encrypted is a Uint8Array — attach it, send it, store it however you want
```

## Decryption

### Decrypt from Cryptify UUID (Yivi web)

```ts
const result = await pg.decrypt({
  uuid: 'the-file-uuid',
  element: '#yivi-popup',
  recipient: 'bob@example.com', // optional hint
});

result.download('decrypted-files.zip');
console.log('Sender:', result.sender);
```

### Decrypt raw data

```ts
const result = await pg.decrypt({
  data: encryptedBytes,
  element: '#yivi-popup',
  recipient: 'bob@example.com',
});
// result.plaintext is a Uint8Array
// result.sender contains verified sender identity
```

## Signing Methods

```ts
// Business API key (server-side)
pg.sign.apiKey('your-api-key')

// Yivi web session (browser, inline QR code)
pg.sign.yivi({ element: '#yivi-popup', senderEmail: 'alice@example.com' })

// Custom session callback (email addons, mobile apps, etc.)
pg.sign.session(
  async ({ con, sort }) => {
    // Show your own Yivi UI, return the JWT
    return await myCustomYiviFlow(con, sort);
  },
  { senderEmail: 'alice@example.com' }
)
```

## Recipients

```ts
// Encrypt for an exact email address
pg.recipient.email('bob@example.com')

// Encrypt for anyone with an email at a domain
pg.recipient.emailDomain('bob@example-org.com')

// Encrypt with custom attribute policy
pg.recipient.withPolicy('bob@example.com', [
  { t: 'pbdf.sidn-pbdf.email.email', v: 'bob@example.com' },
  { t: 'pbdf.gemeente.personalData.surname', v: 'Smith' },
])
```

## Email Integration

For email clients (Thunderbird, Outlook, etc.) that need to encrypt/decrypt email bodies:

```ts
// Build inner MIME message
const mime = pg.email.buildMime({
  from: 'alice@example.com',
  to: ['bob@example.com'],
  subject: 'Hello',
  htmlBody: '<p>Secret message</p>',
  attachments: [{ name: 'doc.pdf', type: 'application/pdf', data: pdfBuffer }],
});

// Encrypt the MIME content
const encrypted = await pg.encrypt({
  sign: pg.sign.session(myYiviHandler, { senderEmail: 'alice@example.com' }),
  recipients: [pg.recipient.email('bob@example.com')],
  data: mime,
});

// Create the encrypted email envelope (placeholder HTML + attachment)
const envelope = pg.email.createEnvelope({ encrypted, from: 'alice@example.com' });
// envelope.subject → "PostGuard Encrypted Email"
// envelope.htmlBody → Placeholder HTML with PostGuard branding
// envelope.plainTextBody → Plain text fallback
// envelope.attachment → File("postguard.encrypted")

// --- On the receiving side ---

// Extract ciphertext from a received email
const ciphertext = pg.email.extractCiphertext({
  htmlBody: emailBodyHtml,
  attachments: [{ name: 'postguard.encrypted', data: attachmentBuffer }],
});

// Decrypt
const result = await pg.decrypt({
  data: ciphertext,
  recipient: 'bob@example.com',
  session: async ({ con, sort, hints }) => myYiviHandler(con, sort, hints),
});
// result.plaintext → decrypted MIME content
// result.sender → verified sender identity
```

## Error Handling

```ts
import {
  PostGuardError,
  NetworkError,
  YiviNotInstalledError,
  DecryptionError,
  IdentityMismatchError,
} from '@e4a/pg-js';

try {
  await pg.encrypt(options);
} catch (err) {
  if (err instanceof IdentityMismatchError) {
    // Yivi attributes didn't match the encryption policy
  } else if (err instanceof YiviNotInstalledError) {
    // Yivi peer dependencies not installed
  } else if (err instanceof NetworkError) {
    console.log(err.status, err.body);
  }
}
```

## License

MIT
