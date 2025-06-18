FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Copy bun.lockb if it exists
COPY bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S bunjs
RUN adduser -S sveltekit -u 1001

# Copy built application
COPY --from=builder --chown=sveltekit:bunjs /app/build build/
COPY --from=builder --chown=sveltekit:bunjs /app/node_modules node_modules/
COPY --from=builder --chown=sveltekit:bunjs /app/package.json .

USER sveltekit

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["dumb-init", "bun", "run", "build/index.js"]
