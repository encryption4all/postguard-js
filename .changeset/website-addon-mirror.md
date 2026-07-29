---
'postguard-website': patch
---

Mirror the Outlook add-in manifest from the monorepo's releases instead of the standalone repository, filtered to `outlook-addin-v*` tags so releases of other packages in the shared namespace are not mistaken for add-in releases.

`outlook-addin-v1.0.0` is published, so the mirror expects a matching release and finding none fails loudly rather than being reported as a state to wait out. The error names both plausible causes, since they call for opposite fixes: the release having scrolled out of the 50-release lookback window — which will happen eventually with nothing wrong, because the tag namespace is shared with `@e4a/pg-js`'s far more frequent changesets releases — or the tag pattern, repo, or published state being wrong.
