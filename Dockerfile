FROM node:18-alpine

WORKDIR /app

# Backend dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Frontend dependencies and build
COPY client/package*.json client/
WORKDIR /app/client
RUN npm install && npm run build

# Return to root
WORKDIR /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
ENV NODE_ENV=production
CMD ["npm", "start"]
