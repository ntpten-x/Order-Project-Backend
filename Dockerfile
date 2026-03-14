# syntax=docker/dockerfile:1.7
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_registry=https://registry.npmjs.org/

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --prefer-offline

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_registry=https://registry.npmjs.org/

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev --no-audit

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ecosystem.config.js ./

RUN npm install -g pm2

EXPOSE 3000

CMD ["pm2-runtime", "ecosystem.config.js"]
