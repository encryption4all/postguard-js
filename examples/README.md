# <p align="center"><img src="./img/pg_logo.svg" height="128px" alt="PostGuard" /></p>

> For full documentation, visit [docs.postguard.eu](https://docs.postguard.eu).

Example applications demonstrating PostGuard integration. Contains reference implementations for developers building on PostGuard. Code snippets in docs.postguard.eu come from here.

There are four sub-projects:

- `pg-sveltekit/`: SvelteKit web app using the `@e4a/pg-js` SDK.
- `pg-node/`: Node.js CLI using the `@e4a/pg-js` SDK from a server runtime.
- `pg-dotnet/`: .NET console app using the `E4A.PostGuard` NuGet package.
- `pg-manual/`: manual encryption/decryption using the `@e4a/pg-wasm` library directly.

Each sub-project has its own README with full setup instructions.

## Development

The three JavaScript examples are **pnpm workspace members**, and the two that use `@e4a/pg-js` depend on it as `workspace:*` — the copy in `packages/pg-js`, not a published release. That is deliberate: it is what stops these examples documenting an API the SDK no longer has.

It also means `npm install` inside a sub-directory does not work. npm cannot resolve the `workspace:*` protocol and there are no per-project lockfiles any more. **Install once from the repository root instead:**

```bash
pnpm install          # from the repo root, installs the whole workspace
```

`pg-dotnet` is not a pnpm member and is unaffected; it restores from its own `packages.lock.json`.

### SvelteKit example

```bash
pnpm --filter pg-sveltekit dev
```

See [pg-sveltekit/README.md](pg-sveltekit/README.md) for environment variables and build instructions.

### Node.js example

Requires Node.js 22+ and a PostGuard API key.

```bash
cp examples/pg-node/.env.example examples/pg-node/.env   # set at minimum PG_API_KEY
pnpm --filter pg-node send                               # encrypt + upload + notify recipients
```

See [pg-node/README.md](pg-node/README.md) for the full configuration and modes.

### .NET example

Requires the .NET 10.0+ SDK and a PostGuard API key. The example uses the `E4A.PostGuard` NuGet package, so no Rust toolchain or local build of the native library is needed.

```bash
cd examples/pg-dotnet
export PG_API_KEY="PG-your-key-here"
dotnet run
```

See [pg-dotnet/README.md](pg-dotnet/README.md) for full setup instructions.

### pg-manual example

```bash
pnpm --filter @e4a/pg-example dev
```

See [pg-manual/README.md](pg-manual/README.md) for details.

## Releasing

Nothing here is published or deployed. `examples.yml` builds every example on each pull request, including on changes to `packages/pg-js`, so an SDK change that breaks a documented snippet fails in the pull request that makes it.

## License

MIT
