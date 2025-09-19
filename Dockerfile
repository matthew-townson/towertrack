FROM oven/bun:1.2 AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./
COPY bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun --bun run build

# Production stage
FROM oven/bun:1.2 AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S bunjs
RUN adduser -S sveltekit -u 1001

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy built application and dependencies
COPY --from=builder --chown=sveltekit:bunjs /app/build ./build/
COPY --from=builder --chown=sveltekit:bunjs /app/node_modules ./node_modules/
COPY --from=builder --chown=sveltekit:bunjs /app/package.json ./
COPY --from=builder --chown=sveltekit:bunjs /app/bun.lock* ./

USER sveltekit
EXPOSE 3000

# Use dumb-init to handle signals properly
CMD ["dumb-init", "bun", "--bun", "build/index.js"]
