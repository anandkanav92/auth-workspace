# Stage 1: Build
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /workspace

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./

# Copy auth-google package
COPY packages/auth-google/ packages/auth-google/

# Copy dutch-app
COPY apps/dutch-app/ apps/dutch-app/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build auth-google first
RUN pnpm --filter @myorg/auth-google build

# Build dutch-app with env vars baked in
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_PB_URL

RUN pnpm --filter dutch-app build

# Stage 2: Run
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output
COPY --from=build /workspace/apps/dutch-app/.next/standalone ./
COPY --from=build /workspace/apps/dutch-app/.next/static ./apps/dutch-app/.next/static
COPY --from=build /workspace/apps/dutch-app/public ./apps/dutch-app/public

EXPOSE 3000
CMD ["node", "apps/dutch-app/server.js"]
