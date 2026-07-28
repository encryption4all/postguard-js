# Dev image for `docker compose up`. Build context is the REPO ROOT, not
# apps/website: the site depends on @e4a/pg-js as `workspace:*`, so the whole
# workspace has to be installed for that link to resolve (same reason as
# docker/Dockerfile).
FROM node:24-alpine

RUN corepack enable
WORKDIR /repo

# Manifests first so a source-only change reuses the install layer. Scripts are
# skipped: pg-js's `prepare` builds it, and its sources arrive with the bind
# mount at runtime rather than being baked in.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pg-js/package.json packages/pg-js/
COPY apps/website/package.json apps/website/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Sources are bind-mounted by compose for hot reload; see docker-compose.yml for
# the anonymous volumes that keep the installed node_modules from being shadowed.
WORKDIR /repo/apps/website

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host"]
