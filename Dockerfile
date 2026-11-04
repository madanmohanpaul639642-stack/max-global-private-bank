# ==========================================
# Max Global Private Bank Management System
# Production Dockerfile for Render / Cloud Run / Container Platforms
# ==========================================

FROM node:22-alpine AS runner

WORKDIR /app

# Install security updates & process manager
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Set production environment (PORT can be overridden at runtime by Render/Cloud Run)
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY . .

# Ensure data directory exists with write permissions for SQLite fallback
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user for security compliance
USER node

# Expose container port (Default 3000)
EXPOSE 3000

# Start with dumb-init for proper signal forwarding and graceful shutdown
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
