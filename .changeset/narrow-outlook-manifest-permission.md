---
'postguard-outlook-addin': patch
---

Request `ReadWriteItem` in the manifest instead of `ReadWriteMailbox`.

`ReadWriteMailbox` is the highest permission tier, and an add-in that asks for it can only be installed by an administrator. An individual user cannot sideload it. Nothing in the add-in needs that tier: Microsoft annotates every Office.js member with its minimum permission level, and across the members reachable from `src/` the maximum is read/write item, from six compose writes (`Body.setAsync`, `removeAttachmentAsync`, `addFileAttachmentFromBase64Async`, `saveAsync`, `InternetHeaders.setAsync` and `InternetHeaders.removeAsync`). The members that do require the mailbox tier are unused: `makeEwsRequestAsync`, `getSelectedItemsAsync`, `loadItemByIdAsync`, `masterCategories` and `sendAsync`. So are `getCallbackTokenAsync`, `restUrl` and `ewsUrl`; the read flow avoids EWS deliberately.

`test/manifest-permission.test.ts` pins both halves: the tier the manifest declares, and the absence from `src/` of any member that would need the wider one.

A changed permission tier freezes existing installations until an administrator re-consents (#240), so this is much cheaper before the first AppSource submission than after.
