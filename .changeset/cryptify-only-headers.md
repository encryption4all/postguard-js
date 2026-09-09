---
"@e4a/pg-js": minor
---

Route Cryptify-only headers to Cryptify, never to the PKG.

`PostGuardConfig.headers` is one bag forwarded to every request the SDK makes, to Cryptify and to the PKG alike. The Outlook add-in put `X-Cryptify-Source` in it for Cryptify's per-channel upload metrics; the PKG's CORS allow-list did not include that header, and actix-cors answers a preflight naming an unlisted header with a 400 and no `Access-Control-Allow-Origin`. From the add-in's 2026-07-30 release until encryption4all/postguard#437 allowed the header server-side, no cross-origin PKG call from the deployed add-in succeeded.

The server side is fixed; this closes the client side so a header meant for one PostGuard service can never again lock a browser client out of another. `PostGuardConfig` gains `cryptifyChannel?: string` — set it to name this client's uploads in Cryptify's per-channel metrics (`"outlook"`, `"thunderbird"`, `"website"`, ...) and the SDK sends it as `X-Cryptify-Source` on Cryptify requests only. Every request the SDK makes is now routed through one of two internal helpers: one that strips `X-Cryptify-Source` from the shared `headers` bag for PKG requests, and one that adds it (from `cryptifyChannel`, taking precedence over anything a caller put in `headers`) for Cryptify requests.

A caller that still sets `X-Cryptify-Source` directly in `headers` keeps working against Cryptify with no code change; it just stops reaching the PKG.
