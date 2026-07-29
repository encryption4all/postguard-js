---
'postguard-website': patch
---

Mirror the Outlook add-in manifest from the monorepo's releases instead of the standalone repository, filtered to `outlook-addin-v*` tags so releases of other packages in the shared namespace are not mistaken for add-in releases.

Between that repoint and the first monorepo release there is nothing matching the tag pattern yet, which the sync treated as a failure and logged every 6h. That window is now declared explicitly, as `bootstrap: true` on the target, and only a target inside it may treat a missing release as expected; for any other target the absence still fails loudly as the regression it would be.

The window is a flag in committed code rather than something inferred from the cached metadata, because `DOWNLOADS_DIR` is image content rather than a mounted volume — every fresh container starts from the committed `v0.1.5` metadata, so inferring the window from that file would have re-armed the permissive path on each website deploy and left the regression check live only between a successful sync and the next deploy. The flag also reports itself as stale on every run once a matching release exists, so a one-release allowance cannot quietly become permanent.
