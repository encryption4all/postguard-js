---
'postguard-website': patch
---

Report the real application version. `VITE_APP_VERSION` now comes from the package's own version instead of a `.env` line that release-please was meant to rewrite — that substitution never fired, so GlitchTip release tags and crash reports have carried `1.0.0` since the marker was added.
