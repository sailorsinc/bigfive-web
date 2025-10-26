# Multi-stage build for API server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY packages/transcript-analyzer/package*.json ./packages/transcript-analyzer/
COPY api-server/package*.json ./api-server/

# Install dependencies
RUN cd packages/transcript-analyzer && npm install
RUN cd api-server && npm install

# Copy source code
COPY packages/transcript-analyzer ./packages/transcript-analyzer
COPY api-server ./api-server

# Build packages
RUN cd packages/transcript-analyzer && npm run build
RUN cd api-server && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/packages/transcript-analyzer/dist ./packages/transcript-analyzer/dist
COPY --from=builder /app/packages/transcript-analyzer/package.json ./packages/transcript-analyzer/
COPY --from=builder /app/packages/transcript-analyzer/node_modules ./packages/transcript-analyzer/node_modules

COPY --from=builder /app/api-server/dist ./api-server/dist
COPY --from=builder /app/api-server/package.json ./api-server/
COPY --from=builder /app/api-server/node_modules ./api-server/node_modules

WORKDIR /app/api-server

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/index.js"]
