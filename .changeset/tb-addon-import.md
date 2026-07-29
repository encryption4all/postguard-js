---
'postguard-tb-addon': patch
---

Move the auto-update channel to a stable URL. `manifest.json`'s `update_url` pointed at `postguard-tb-addon/releases/latest/download/updates.json`; in the monorepo `releases/latest` is whichever app released most recently, which carries no `updates.json`, so the channel now reads a raw URL on `main` instead.
