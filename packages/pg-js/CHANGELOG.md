# @e4a/pg-js

## 2.5.0

### Minor Changes

- d0d3034: Answer cryptify's upload challenge, so an upload proves the sender identity the container claims.

  cryptify relays containers it cannot open. It reads a sender identity out of the header, and until now had no way to tell whether the uploader was that person: anyone holding a container someone else sealed could have PostGuard send mail in their name (encryption4all/postguard#358). The server half issues a challenge at `POST /fileupload/init` and verifies a signature over it at finalize; this is the client half.

  `initUpload` carries the new `challenge` field (hex) through on `FileState`, and `finalizeUpload` signs it with the same signing key that sealed the container, sending the signature base64 in `X-PostGuard-Proof`. The signing happens in `@e4a/pg-wasm`'s `signChallenge`, which applies its own domain separator, so the challenge is passed to it exactly as it arrived — a client that constructed the signed message itself would be blind-signing whatever the server chose.

  The field is optional and so is the header. No cryptify deployed today issues a challenge, so the no-challenge path is the live one: nothing is sent, nothing is fabricated, and the upload completes as before.

  Requires `@e4a/pg-wasm` 0.6.5, which is where `signChallenge` first ships; the dependency range moves from `^0.6.1` to `^0.6.5`. A range that merely resolves the fix would leave a consumer whose lockfile pinned 0.6.1 calling a function that does not exist.

### Patch Changes

- 9f61ed0: Stop presenting the pre-decryption sender on `/download` as verified.

  The `Ready` state (the screen with the Yivi QR on it, before any user secret key exists and before anything is decrypted) rendered a green tick, the copy "The files are from", and the signing attribute chips next to a sender address read straight off the sealed header via `Opened.inspect()`. That value carries a valid signature over the header bytes, but nothing binds it to the ciphertext (encryption4all/postguard#338): any party the PKG will issue a signing key to can re-sign someone else's header with their own key and be shown in its place. The pg-core change that would detect that swap (encryption4all/postguard#347) works inside the AEAD, so even once it ships in a `@e4a/pg-wasm` release it can only run during decryption, and will never reach this screen.

  `Ready` now keeps the address, because it is what the user needs to decide whether to scan at all and withholding it would make them pay the Yivi cost before learning anything. What it drops is the tick and the chips. The label reads "These files claim to be from", with the caveat "We can confirm this only after decryption." The `Confirm` and `Done` states are unchanged; they render `result.sender` from `decrypt()`, and whether a post-decryption tick is warranted at all is encryption4all/postguard#338's question rather than this change's.

  In `@e4a/pg-js` this is a documentation change only, with no identifier renames. The doc comments on `InspectResult.sender`, `InspectSealedResult.sender`, `inspectSealed()` and `Opened.inspect()` now state that the identity is claimed rather than verified. They stop short of promising that `decrypt()`'s `sender` is bound to the ciphertext, because it is not: the public signing policy travels outside the AEAD in the pinned `@e4a/pg-wasm` (0.6.1) and in every version published as of 2026-08-10 (0.6.3 is the newest), so the swap is reported after decryption too. postguard#347 adds an AEAD-protected copy of the public signing policy to pg-core, and the comments say what it will take for that copy to reach a consumer of this SDK.

## 2.4.0

### Minor Changes

- 5fd30b7: Export the MIME reader, PostGuard detection and the archival armor readers, so both add-ins read the envelope through one implementation instead of two hand-rolled copies.

  New exports: `parseDecryptedMime`, `readMimeHeader`, `bodyFromMime`, `isMultipart`, `detectPostGuard`, `extractArmoredCiphertext`, `looksLikeArmoredPostGuard`, `POSTGUARD_ENCRYPTED_FILENAME`, and the `ParsedMessage` / `ParsedAttachment` / `DetectPostGuardInput` types. Additive only — no existing signature changes.

  Two fixes came out of the move:

  - **Quoted-printable bodies with non-ASCII characters were decoded wrong.** Each `=XX` was mapped through `String.fromCharCode`, giving one character per octet, so `caf=C3=A9` read back as `cafÃ©` rather than `café`. The byte path compounded it by re-encoding that as UTF-8, doubling every octet above 0x7f and silently corrupting quoted-printable attachments. Octets are now collected and decoded once.
  - `extractCiphertext`'s documentation claimed it read "attachment or armored body". It has only ever read the attachment. The armor path is now a separate, explicitly archival export, which is what `COMPATIBILITY.md`'s never-drops guarantee for stored artifacts actually requires.

## 2.3.4

### Patch Changes

- 82717a2: Fix the npm package page after the monorepo move: `repository.directory` points npmjs.com at `packages/pg-js` so the README logo and Repository link resolve again, and the published README now documents the changesets release flow and pnpm development commands.
