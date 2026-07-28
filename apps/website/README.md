# <p align="center"><img src="./img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/postguard-website).

SvelteKit web frontend for encrypting and sending files using [Yivi](https://yivi.app) identity attributes. This is the main PostGuard web application where users can encrypt files and send them to recipients.

## Development

Docker Compose is the recommended way to get started:

```bash
git submodule update --init --recursive
./scripts/gen-irma-key.sh   # once: throwaway JWT key for the local irma-server
docker compose up
```

`gen-irma-key.sh` is idempotent and the key it writes is gitignored. Skipping it
does not fail loudly: Docker creates an empty _directory_ at the missing bind
mount, and irma-server then starts against a directory instead of a key, taking
the Yivi disclosure flow down.

The website is available at http://localhost:8080.

To run without Docker (from the monorepo root — this app is a pnpm workspace
package and its `@e4a/pg-js` dependency is a workspace link):

```bash
pnpm install
pnpm --filter postguard-website dev
```

### Environment variables

| Variable               | Description                                                               | Default                 |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------- |
| `VITE_FILEHOST_URL`    | Filehosting service URL (Cryptify)                                        | `http://localhost:8000` |
| `VITE_PKG_URL`         | PKG service URL                                                           | `http://localhost:8087` |
| `VITE_MAX_UPLOAD_SIZE` | Maximum file upload size in bytes (default: 5 GB)                         | -                       |
| `VITE_ROLLING_LIMIT`   | Rolling upload limit in bytes per email per 2 weeks (default: 5 GB)       | -                       |
| `VITE_CHUNK_SIZE`      | Optional: upload chunk size in bytes. If unset, uses pg-js default (5 MB) | -                       |

## Releasing

Releases are managed by [changesets](https://github.com/changesets/changesets) from the monorepo root. A PR that should ship adds a changeset (`pnpm changeset`); merging to `main` opens or updates a "Version Packages" PR, and merging that bumps this package's version. The Docker image is published to GHCR on every push to `main` as `:edge` and as `:<version>` from this package's `version` field.

The app is `private: true`, so changesets versions it without publishing it to npm.

## License

MIT
