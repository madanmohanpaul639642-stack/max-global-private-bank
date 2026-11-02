# ==========================================
# Max Global Private Bank Management System
# Production Dockerfile for Google Cloud Run
# ==========================================

FROM node:22-alpine AS runner

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

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

# Expose Cloud Run default port
EXPOSE 8080

# Start with dumb-init for proper signal forwarding
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
