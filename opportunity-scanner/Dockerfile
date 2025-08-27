# Multi-stage build for optimal image size
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S appuser -u 1001

# Copy package files
COPY package*.json ./
COPY --chown=appuser:nodejs package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY --chown=appuser:nodejs . .
USER appuser
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production app stage
FROM base AS production
ENV NODE_ENV=production

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/src ./src
COPY --from=builder --chown=appuser:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown appuser:nodejs /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

USER appuser
EXPOSE 3000
CMD ["node", "src/index.js"]

# Worker stage for background jobs
FROM production AS worker
ENV NODE_ENV=production
CMD ["node", "src/worker.js"]