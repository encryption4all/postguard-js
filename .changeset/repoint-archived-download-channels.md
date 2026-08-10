---
'postguard-website': patch
---

Repoint the add-on download channels off the archived repositories.

`/downloads/postguard-tb-addon.xpi` was a 302 to `postguard-tb-addon/releases/latest/download/postguard-tb-addon.xpi` in the dev nginx config. That repository is archived and its `releases/latest` now resolves to the tag `channel-migration-0.9.4`, which carries only `updates.json` and no `.xpi`, so the redirect returned a hard 404. The path now falls through to the dev server, which serves the mirrored artifact from `static/downloads/` — the same thing prod serves from the synced htdocs dir.

The mirrored artifacts themselves were still the archived repositories' last cuts: the Thunderbird `.xpi` from `postguard-tb-addon` v0.9.3 and, more visibly, the Outlook `manifest.xml` from `postguard-outlook-addon` v0.1.5. `scripts/sync-addons.mjs` has pointed both targets at this repository for a while, so re-running it moves them to `tb-addon-v0.9.4` and `outlook-addin-v1.0.0`.

Also fixes `docker-compose.prod.yml`, which pulled `ghcr.io/encryption4all/cryptify-backend:edge`. That image name was renamed to `cryptify` years ago and the old name is not a published package, so the compose file could not have pulled it.
