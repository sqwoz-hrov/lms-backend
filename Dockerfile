# Builder stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE $PORT

CMD ["node", "dist/main"]
