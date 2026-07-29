---
'postguard-website': patch
---

Mirror the Outlook add-in manifest from the monorepo's releases instead of the standalone repository, filtered to `outlook-addin-v*` tags so releases of other packages in the shared namespace are not mistaken for add-in releases.

Between that repoint and the first monorepo release there is nothing matching the tag pattern yet, which the sync treated as a failure and logged every 6h. It now reports that once and keeps serving the committed artifact — but only while no matching release has ever been mirrored. Once one has, a pattern that stops matching is a real regression and still fails loudly.
