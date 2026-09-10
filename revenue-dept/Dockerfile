# GovConnect - Revenue Department Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose default service port
EXPOSE 4001

ENV NODE_ENV=production
ENV PORT=4001

CMD ["node", "src/server.js"]
