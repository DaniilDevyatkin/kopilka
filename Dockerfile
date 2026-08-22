FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS migration-dependencies
WORKDIR /app
COPY deploy/migrator/package.json deploy/migrator/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npx next build --webpack

FROM migration-dependencies AS migrator
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
RUN mkdir -p /app/.next/cache /app/data/uploads \
  && chown -R node:node /app/.next/cache /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
