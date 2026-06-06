# Stage 1: build web
FROM node:24-alpine AS web-builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages packages
COPY apps/finance-tracker apps/finance-tracker
RUN corepack enable && pnpm install --frozen-lockfile
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
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
