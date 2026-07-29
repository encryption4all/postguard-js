# <p align="center"><img src="packages/pg-js/img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/postguard-js).

Monorepo for the PostGuard JS fleet.

| Path | What |
| --- | --- |
| [`packages/pg-js`](packages/pg-js) | `@e4a/pg-js` — the published browser/Node SDK |
| `apps/*` | PostGuard clients (website, mail addons) — imported incrementally, see [#123](https://github.com/encryption4all/postguard-js/issues/123) |

## Development

pnpm workspaces. From the repo root:

```bash
pnpm install   # runs the prebuild generators + a full build via `prepare`
pnpm build
pnpm test
```

## Releasing

Releases are managed by [changesets](https://github.com/changesets/changesets): a PR that should ship adds a changeset (`pnpm changeset`); merging to `main` opens or updates a "Version Packages" PR; merging that publishes to npm with provenance.

The public type surface of `@e4a/pg-js` is tracked in [`packages/pg-js/etc/pg-js.api.md`](packages/pg-js/etc/pg-js.api.md). `pnpm build` fails when that file no longer matches the build, so a change to the compatibility contract always lands as a reviewable diff. Refresh it with `pnpm api:update` from `packages/pg-js`.

## License

MIT.
