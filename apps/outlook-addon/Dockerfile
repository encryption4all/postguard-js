# Build context is the REPO ROOT, not apps/outlook-addon: the add-in depends on
# @e4a/pg-js as `workspace:*`, so the whole workspace has to be installed for
# that link to resolve.
## Build stage ##############################################################
FROM node:24-alpine AS build

WORKDIR /repo

# Build-time configuration baked into the bundle and manifest.
ARG ADDIN_PUBLIC_URL=https://addin.postguard.eu/
ARG PKG_URL=https://postguard.eu/pkg
ARG CRYPTIFY_URL=https://storage.postguard.eu
ARG POSTGUARD_WEBSITE_URL=https://postguard.eu

ENV ADDIN_PUBLIC_URL=${ADDIN_PUBLIC_URL} \
    PKG_URL=${PKG_URL} \
    CRYPTIFY_URL=${CRYPTIFY_URL} \
    POSTGUARD_WEBSITE_URL=${POSTGUARD_WEBSITE_URL}

RUN corepack enable

# Manifests first so a source-only change reuses the install layer. Scripts are
# skipped because pg-js's `prepare` builds it and its sources are not here yet.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/pg-js/package.json packages/pg-js/
COPY apps/outlook-addon/package.json apps/outlook-addon/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/pg-js/ packages/pg-js/
COPY apps/outlook-addon/ apps/outlook-addon/

# pg-js first: the add-in imports it through the workspace link, so its dist/
# must exist. webpack refuses the staging fallbacks in production mode, so the
# four ARGs above are load-bearing rather than decorative.
RUN pnpm --filter @e4a/pg-js build \
 && pnpm --filter postguard-outlook-addin exec webpack --mode production

## Runtime stage ############################################################
FROM nginx:1.27-alpine AS runtime

COPY apps/outlook-addon/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/outlook-addon/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
