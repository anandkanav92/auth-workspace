# Stage 1: Install deps & build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/auth-google/package.json packages/auth-google/
COPY apps/dutch-app/package.json apps/dutch-app/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/auth-google/ packages/auth-google/
COPY apps/dutch-app/ apps/dutch-app/

# Build shared package first, then the app
RUN pnpm --filter @myorg/auth-google build
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_PB_URL
RUN pnpm --filter dutch-app build

# Stage 2: Run
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /workspace/apps/dutch-app/.next/standalone ./
COPY --from=builder /workspace/apps/dutch-app/.next/static ./apps/dutch-app/.next/static
COPY --from=builder /workspace/apps/dutch-app/public ./apps/dutch-app/public

EXPOSE 3000
CMD ["node", "apps/dutch-app/server.js"]
