# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ecosystem.config.js ./

RUN npm install -g pm2

EXPOSE 3000

CMD ["pm2-runtime", "ecosystem.config.js"]
