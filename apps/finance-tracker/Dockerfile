# Stage 1: build web
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages packages
COPY apps/finance-tracker apps/finance-tracker
# Pin pnpm to the version that generated pnpm-lock.yaml. Without a pin, corepack
# pulls the latest pnpm (11.x), which turns "ignored build scripts" into a hard
# error under --frozen-lockfile (ERR_PNPM_IGNORED_BUILDS) and fails the build.
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate && pnpm install --frozen-lockfile
# Vite inlines these at build time, so every VITE_* the web build reads
# (grep web/src for import.meta.env.) must be declared here AND forwarded as a
# build arg in docker-compose.yml. The optional ones can be empty.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_API_BASE_URL
ARG VITE_SENTRY_DSN
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN pnpm --filter finance-tracker-web build

# Stage 2: build server
FROM node:24-alpine AS server-builder
WORKDIR /app
COPY --from=web-builder /app .
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate && pnpm --filter finance-tracker-server build

# Stage 3: runtime
FROM node:24-alpine
WORKDIR /app
# Copy the fully-installed, built workspace as-is (server dist + web dist + the
# pnpm node_modules symlink farm). Running the server from its real workspace
# path keeps pnpm's symlinked module resolution intact (a relocated dist can't
# find @hono/node-server etc.), and serveStatic locates the SPA at ../../web/dist.
COPY --from=server-builder /app /app
WORKDIR /app/apps/finance-tracker/server
EXPOSE 80
ENV PORT=80
CMD ["node", "dist/index.js"]
