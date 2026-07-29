---
'postguard-website': patch
---

Mirror the Outlook add-in manifest from the monorepo's releases instead of the standalone repository, filtered to `outlook-addin-v*` tags so releases of other packages in the shared namespace are not mistaken for add-in releases.
