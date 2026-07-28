# <p align="center"><img src="./img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu/repos/postguard-website).

SvelteKit web frontend for encrypting and sending files using [Yivi](https://yivi.app) identity attributes. This is the main PostGuard web application where users can encrypt files and send them to recipients.

## Development

Docker Compose is the recommended way to get started:

```bash
git submodule update --init --recursive
docker-compose up
```

The website is available at http://localhost:8080.

To run without Docker:

```bash
npm install
npm run dev
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

Releases are automated with [release-please](https://github.com/googleapis/release-please). Merging to `main` triggers a release PR, and merging that PR publishes Docker images to GHCR.

## License

MIT
