# postguard-tb-addon

## 0.9.7

### Patch Changes

- Updated dependencies [ecb9411]
  - @e4a/pg-js@2.6.0

## 0.9.6

### Patch Changes

- Updated dependencies [9f61ed0]
- Updated dependencies [d0d3034]
  - @e4a/pg-js@2.5.0

## 0.9.5

### Patch Changes

- Updated dependencies [5fd30b7]
  - @e4a/pg-js@2.4.0

## 0.9.4

### Patch Changes

- 65acbad: Move the auto-update channel to a stable URL. `manifest.json`'s `update_url` pointed at `postguard-tb-addon/releases/latest/download/updates.json`; in the monorepo `releases/latest` is whichever app released most recently, which carries no `updates.json`, so the channel now reads a raw URL on `main` instead.
