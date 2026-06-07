# Stage 1: build web
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages packages
COPY apps/finance-tracker apps/finance-tracker
RUN corepack enable && pnpm install --frozen-lockfile
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
RUN pnpm --filter finance-tracker-server build

# Stage 3: runtime (production deps only — reviewer fix N7)
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY --from=server-builder /app/apps/finance-tracker/server/dist ./server
COPY --from=web-builder /app/apps/finance-tracker/web/dist ./web
COPY --from=server-builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=server-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=server-builder /app/apps/finance-tracker/server/package.json ./server/package.json
RUN cd server && pnpm install --prod --frozen-lockfile --ignore-scripts
EXPOSE 80
ENV PORT=80
CMD ["node", "server/index.js"]
