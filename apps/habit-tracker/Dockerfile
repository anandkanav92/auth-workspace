# Stage 1: Build
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /workspace

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./

# Copy auth-google package
COPY packages/auth-google/ packages/auth-google/

# Copy habit-tracker app
COPY apps/habit-tracker/ apps/habit-tracker/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build auth-google first
RUN pnpm --filter @myorg/auth-google build

# Build habit-tracker with env vars baked in
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID

RUN pnpm --filter habit-tracker build

# Stage 2: Serve
FROM nginx:alpine

COPY apps/habit-tracker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/habit-tracker/dist /usr/share/nginx/html

EXPOSE 80
