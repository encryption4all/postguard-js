# <p align="center"><img src="./img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/postguard-tb-addon).

End-to-end email encryption extension for Thunderbird. Uses identity-based encryption and [Yivi](https://yivi.app) so users can send and receive encrypted email without managing keys or certificates. This is one of the main end-user products in the PostGuard system.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Thunderbird](https://www.thunderbird.net/) 128+

### Setup

```bash
pnpm install           # from the monorepo root; @e4a/pg-js is a workspace link
cp .env.example .env   # adjust if needed
```

### Build and run

From this directory (or with `pnpm --filter postguard-tb-addon <script>` from the
root):

```bash
pnpm build             # production build -> dist/
pnpm build:dev         # development build (no minification, keeps console.log)
pnpm watch             # dev build with file watching
```

To load the extension in Thunderbird: open Add-ons Manager, click the gear icon, select Debug Add-ons, then Load Temporary Add-on and pick any file inside the `dist/` folder.

## Releasing

Versions are managed by [changesets](https://github.com/changesets/changesets)
from the monorepo root — do **not** hand-edit them:

1. Add a changeset in the PR that should ship: `pnpm changeset`.
2. Merge it. A "Version Packages" PR appears.
3. Merge that. It bumps `package.json` and runs `sync-version`, which mirrors the
   version into `manifest.json` and appends an `updates.json` entry.
4. Tag the result **`tb-addon-v<version>`** and push it. That builds the `.xpi`
   and creates the GitHub release.

The tag prefix is required. This repo's tag namespace is shared with
`@e4a/pg-js`'s changesets releases, so a bare `v<version>` matches no trigger in
`.github/workflows/tb-addon.yml` and would be a silent no-op.

`check-version` fails any PR where `package.json`, `manifest.json` and
`updates.json` disagree, which is what hand-editing a version causes.

## Build reproducibility

The add-on's WebAssembly module comes from the published `@e4a/pg-wasm`
npm package (transitively, via `@e4a/pg-js`) and is inlined into the
JavaScript bundle by esbuild at build time. See
[`docs/build-reproducibility.md`](./docs/build-reproducibility.md) for
the full supply chain, hash-verification steps, and reviewer notes for
AMO submissions.

## License

MIT
