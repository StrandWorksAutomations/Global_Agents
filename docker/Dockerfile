# TechForge AI Agent Suite - Production Docker Image
# Multi-stage build for optimal size and security

# Stage 1: Python base with dependencies
FROM python:3.11-slim as python-base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Node.js base for frontend and SDK
FROM node:18-slim as node-base

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Stage 3: Final production image
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    TECHFORGE_HOME=/app \
    TECHFORGE_DATA=/data \
    TECHFORGE_CONFIG=/config

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js runtime
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r techforge && useradd -r -g techforge techforge

# Setup directories
RUN mkdir -p /app /data /config /logs \
    && chown -R techforge:techforge /app /data /config /logs

WORKDIR /app

# Copy Python dependencies from builder
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-base /usr/local/bin /usr/local/bin

# Copy Node modules from builder
COPY --from=node-base /app/node_modules ./node_modules

# Copy application code
COPY --chown=techforge:techforge . .

# Switch to non-root user
USER techforge

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports
EXPOSE 8080 8081 3000

# Default command
CMD ["python", "cli/techforge.py", "server"]