# postguard-js

Monorepo for the PostGuard JS fleet.

| Path | What |
| --- | --- |
| [`packages/pg-js`](packages/pg-js) | `@e4a/pg-js` — the published browser/Node SDK |
| `apps/*` | PostGuard clients (website, mail addons) — imported incrementally, see encryption4all/postguard-js#123 |

Tooling: pnpm workspaces; releases via [changesets](https://github.com/changesets/changesets). `pnpm install && pnpm build && pnpm test`.
