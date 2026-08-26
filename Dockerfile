# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps (copy manifests first for layer caching)
COPY package.json package-lock.json ./
COPY packages/shared/package.json  packages/shared/
COPY packages/server/package.json  packages/server/
COPY packages/client/package.json  packages/client/
RUN npm ci

# Copy sources
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/client packages/client

# Build shared → server → client (dependency order)
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/server

# VITE_SERVER_URL is baked into the client bundle at build time.
# Override with --build-arg if the server is not on the same host/port.
ARG VITE_SERVER_URL=ws://localhost:2567
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build --workspace=packages/client


# ─── Stage 2: production server ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Install only production deps for server + shared
COPY package.json package-lock.json ./
COPY packages/shared/package.json  packages/shared/
COPY packages/server/package.json  packages/server/
RUN npm ci --omit=dev --workspace=packages/shared --workspace=packages/server

# Built artifacts
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist

ENV NODE_ENV=production
ENV PORT=2567

EXPOSE 2567

CMD ["node", "packages/server/dist/index.js"]


# ─── Stage 3: nginx (serves client static files, proxies WS to server) ───────
FROM nginx:alpine AS web

COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
