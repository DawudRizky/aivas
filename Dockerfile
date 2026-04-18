# Production multi-stage Dockerfile for aivas Next.js app
# Builds the app then runs it with `next start` on port 3000

### Builder
FROM node:20-alpine AS builder
WORKDIR /app
# Do not set NODE_ENV=production here — we need devDependencies for the build

# install dependencies (prefer lockfile if present)
COPY package*.json ./
# Install all dependencies (including dev deps required for build)
# Use `--include=dev` to ensure devDependencies are installed in environments
# where `NODE_ENV` might otherwise exclude them.
RUN npm ci --include=dev --no-audit --no-fund

# copy source and build
COPY . .
RUN npm run build

### Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# copy built assets and production deps
COPY --from=builder /app/package*.json ./
# Install only production dependencies in the runtime image
RUN npm ci --omit=dev --no-audit --no-fund

# copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000

# copy entrypoint for loading env and better logs (if present)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]
