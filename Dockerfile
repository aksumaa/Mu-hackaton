FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build \
  && mkdir -p /data/storage \
  && chown -R node:node /app /data/storage

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
