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

# --webpack instead of `npm run build`: Next 16 defaults to Turbopack, which needs
# the @next/swc-linux-x64-gnu native binary. npm resolves that optional dependency
# inconsistently here -- one build got it, the next fell back to the musl variant
# and died on `libc.musl-x86_64.so.1: cannot open shared object file` under Debian.
# Webpack needs no native bindings, so the build stops depending on that lottery.
RUN npx prisma generate && npx next build --webpack

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
