---
"postguard-website": patch
"@e4a/pg-js": patch
---

Stop presenting the pre-decryption sender on `/download` as verified.

The `Ready` state (the screen with the Yivi QR on it, before any user secret key exists and before anything is decrypted) rendered a green tick, the copy "The files are from", and the signing attribute chips next to a sender address read straight off the sealed header via `Opened.inspect()`. That value carries a valid signature over the header bytes, but nothing binds it to the ciphertext (encryption4all/postguard#338): any party the PKG will issue a signing key to can re-sign someone else's header with their own key and be shown in its place. The binding fix (encryption4all/postguard#347) sits inside the AEAD, so even once it ships in a `@e4a/pg-wasm` release it can only run during decryption, and will never reach this screen.

`Ready` now keeps the address, because it is what the user needs to decide whether to scan at all and withholding it would make them pay the Yivi cost before learning anything. What it drops is the tick and the chips. The label reads "These files claim to be from", with the caveat "We can confirm this only after decryption." The `Confirm` and `Done` states are unchanged; they render `result.sender` from `decrypt()`, and whether a post-decryption tick is warranted at all is encryption4all/postguard#338's question rather than this change's.

In `@e4a/pg-js` this is a documentation change only, with no identifier renames. The doc comments on `InspectResult.sender`, `InspectSealedResult.sender`, `inspectSealed()` and `Opened.inspect()` now state that the identity is claimed rather than verified. They stop short of promising that `decrypt()`'s `sender` is bound to the ciphertext, because it is not: the public signing policy travels outside the AEAD in every `@e4a/pg-wasm` this package can resolve, so the swap is reported after decryption too. postguard#347 adds the binding to pg-core, and the comments say what it will take for that to reach a consumer of this SDK.
