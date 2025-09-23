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
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 bunjs
RUN useradd -m -u 1001 -g bunjs sveltekit

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
