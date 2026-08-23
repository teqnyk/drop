# Drop on Fly.io.
#
# Multi-stage so the runtime image carries the built app and nothing else — no
# pnpm store, no source, no dev dependencies.

FROM node:22-alpine AS base
# The MongoDB driver and Next both want these on Alpine.
RUN apk add --no-cache libc6-compat
# Pinned, as in package.json: corepack otherwise pulls pnpm 11, which errors on
# un-approved build scripts and writes a broken workspace file.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ── dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are INLINED into the bundle at build time and cannot be
# corrected afterwards with a secret. They arrive as build args, which is why
# fly.toml passes them and `fly deploy` must too.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080
# Not root. A demonstration app that is deliberately broken in public should
# not be broken as root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ is kept non-empty (see public/.gitkeep) so this cannot fail on a
# fresh clone, and so files added there later actually reach the image.
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
