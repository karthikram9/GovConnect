# GovConnect - Social Welfare Department Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose service port
EXPOSE 4002

ENV NODE_ENV=production
ENV PORT=4002

CMD ["node", "src/server.js"]
