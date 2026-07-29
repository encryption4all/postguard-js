---
'postguard-outlook-addin': patch
---

Build and release the add-in from the monorepo: CI runs lint, typecheck, tests, manifest validation, nginx validation and a check that every host the build can bake in resolves; the image and the sideloadable manifest publish from an `outlook-addin-v*` tag. Corrects the Cryptify hostname to `storage.postguard.eu` in this copy — `fileshare.postguard.eu` no longer resolves and broke file sending.
