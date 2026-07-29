---
'postguard-outlook-addin': patch
---

Build and release the add-in from the monorepo: CI runs lint, typecheck, tests, manifest validation, nginx validation and a check that every host the build can bake in resolves; the image and the sideloadable manifest publish from an `outlook-addin-v*` tag. Corrects the Cryptify hostname to `storage.postguard.eu` in this copy — `fileshare.postguard.eu` no longer resolves and broke file sending.

The shipped manifest now allowlists only the origins its own build uses. Previously every build allowlisted both the production and staging add-in origins plus two spellings of its own, because the source manifest lists both environments and the localhost entry is rewritten per target. A production build refuses outright if an origin it needs is absent, since a missing `AppDomain` breaks the Yivi dialog only at send time, where no CI job can see it.

CI validates `dist/manifest.xml` rather than the source, so the file admins actually sideload is the one that gets checked.
