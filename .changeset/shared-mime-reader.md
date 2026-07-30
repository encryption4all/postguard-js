---
'@e4a/pg-js': minor
---

Export the MIME reader, PostGuard detection and the archival armor readers, so both add-ins read the envelope through one implementation instead of two hand-rolled copies.

New exports: `parseDecryptedMime`, `readMimeHeader`, `bodyFromMime`, `isMultipart`, `detectPostGuard`, `extractArmoredCiphertext`, `looksLikeArmoredPostGuard`, `POSTGUARD_ENCRYPTED_FILENAME`, and the `ParsedMessage` / `ParsedAttachment` / `DetectPostGuardInput` types. Additive only — no existing signature changes.

Two fixes came out of the move:

- **Quoted-printable bodies with non-ASCII characters were decoded wrong.** Each `=XX` was mapped through `String.fromCharCode`, giving one character per octet, so `caf=C3=A9` read back as `cafÃ©` rather than `café`. The byte path compounded it by re-encoding that as UTF-8, doubling every octet above 0x7f and silently corrupting quoted-printable attachments. Octets are now collected and decoded once.
- `extractCiphertext`'s documentation claimed it read "attachment or armored body". It has only ever read the attachment. The armor path is now a separate, explicitly archival export, which is what `COMPATIBILITY.md`'s never-drops guarantee for stored artifacts actually requires.
