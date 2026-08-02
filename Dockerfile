FROM node:22-bookworm-slim

WORKDIR /app

# openssl: Prisma query engine. curl: Coolify HTTP healthcheck.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# NODE_ENV stays unset here on purpose: next build needs the devDependencies
# (typescript, tailwind, the react compiler babel plugin, tsx for the worker).
RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
