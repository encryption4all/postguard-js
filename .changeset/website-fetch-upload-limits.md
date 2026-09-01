---
"postguard-website": minor
---

Take cryptify's upload limits from `GET /limits` instead of from the build.

`VITE_MAX_UPLOAD_SIZE` and `VITE_ROLLING_LIMIT` were source-controlled copies of two numbers cryptify enforces, and the 14-day rolling window was a third copy hard-coded in `localUsage.ts`. They drove the dropzone cap, the "X GB remaining" line and the send button, so correcting one meant rebuilding and redeploying the site. The compose screen now fetches all three from cryptify's `GET /limits` (encryption4all/postguard#386) when it loads, and both env vars are gone.

The fetch fails closed. Until the limits arrive the send button stays disabled, and if the call fails the screen says so instead of falling back to a baked-in default: the fetch targets the same host the upload needs, so a failure means the upload was never going to succeed, and a stale fallback would only ever be read in the one case where nobody can see it is stale.

Sizes are now decimal throughout, against the decimal bytes cryptify serves. The "over the limit" figures in `FileInput` and `SendButton` were computed in GiB while the limit next to them was shown in GB, so the two disagreed by about 7%.
