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

## License

MIT.
