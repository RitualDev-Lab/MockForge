# ─── Stage 1: Build & Compile ──────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm run build
RUN npm prune --production

# ─── Stage 2: Distroless Minimal Non-Root Runtime ──────────────────────
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime

LABEL maintainer="RitualDev Lab <security@ritualdev.in>"
LABEL org.opencontainers.image.title="MockForge"
LABEL org.opencontainers.image.description="Enterprise Intelligent Relational Mock DB & Synthetic Test Data Engine"
LABEL org.opencontainers.image.source="https://github.com/RitualDev-Lab/MockForge"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/bin ./bin
COPY --from=builder /build/node_modules ./node_modules

USER nonroot:nonroot

ENV NODE_ENV=production

ENTRYPOINT ["/nodejs/bin/node", "bin/mockforge.js"]
CMD ["mcp"]
