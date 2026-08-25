---
"@e4a/pg-js": minor
---

Answer cryptify's upload challenge, so an upload proves the sender identity the container claims.

cryptify relays containers it cannot open. It reads a sender identity out of the header, and until now had no way to tell whether the uploader was that person: anyone holding a container someone else sealed could have PostGuard send mail in their name (encryption4all/postguard#358). The server half issues a challenge at `POST /fileupload/init` and verifies a signature over it at finalize; this is the client half.

`initUpload` carries the new `challenge` field (hex) through on `FileState`, and `finalizeUpload` signs it with the same signing key that sealed the container, sending the signature base64 in `X-PostGuard-Proof`. The signing happens in `@e4a/pg-wasm`'s `signChallenge`, which applies its own domain separator, so the challenge is passed to it exactly as it arrived — a client that constructed the signed message itself would be blind-signing whatever the server chose.

The field is optional and so is the header. No cryptify deployed today issues a challenge, so the no-challenge path is the live one: nothing is sent, nothing is fabricated, and the upload completes as before.

Requires `@e4a/pg-wasm` 0.6.5, which is where `signChallenge` first ships; the dependency range moves from `^0.6.1` to `^0.6.5`. A range that merely resolves the fix would leave a consumer whose lockfile pinned 0.6.1 calling a function that does not exist.
