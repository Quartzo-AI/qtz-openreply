# Quartzo deployment

This fork runs on the Quartzo Coolify fleet, not on Vercel + Railway as the
upstream setup guide assumes. Nothing in `app/`, `lib/` or `worker/` is forked;
the delta is the container build and one reverse-proxy setting.

## Shape

| Piece | Where |
| --- | --- |
| Web app | Coolify app `openreply`, qtz-compute |
| Worker | Coolify app `openreply-worker`, qtz-compute |
| Postgres | Coolify-managed `openreply-postgres` |
| Redis | Coolify-managed `openreply-redis` |
| Public URL | https://openreply.quartzo.ai (Traefik edge on qtz-primary) |
| Secrets | Infisical `/apps/openreply` (env `prod`) |

Both processes run the **same image**. `PROCESS_ROLE` selects `web` or `worker`
at container start, so they cannot drift on `ENCRYPTION_KEY`, `DATABASE_URL` or
`REDIS_URL` — a drift on the first of those silently breaks token decryption on
every send.

Migrations run from the web entrypoint when `RUN_MIGRATIONS=true`.

## Things that will bite you

- **Never set `NODE_ENV` as a Coolify environment variable.** Coolify exposes
  env vars at build time, and `NODE_ENV=production` makes `npm ci` skip
  devDependencies, so `next build` dies on `Cannot find module
  '@tailwindcss/postcss'`. The Dockerfile sets it *after* the build instead.
- **The build is pinned to Webpack** (`next build --webpack`). npm resolved
  Next's optional `@next/swc-linux-x64-gnu` binary inconsistently on the build
  host; when it fell back to the musl variant the build died on
  `libc.musl-x86_64.so.1`, leaving Turbopack with no native bindings.
- **`experimental.serverActions.allowedOrigins` is load-bearing.** The edge
  proxies with `passHostHeader: false`, so `x-forwarded-host` is the internal
  sslip hostname while `origin` is the public domain. Without the allowlist,
  Next rejects every Server Action — which means every login.
- **`/api/health` is not a liveness probe.** It returns 503 unless the worker
  heartbeat is fresh, so the Coolify healthcheck uses `/login`. Use
  `/api/health` as the real end-to-end smoke: it reports database, redis,
  queue and worker.

## Login

Auth is upstream's Resend email magic link — there is no password. Sending uses
a `Sending access` Resend key scoped to `quartzo.ai`, from `login@quartzo.ai`.

## Not configured yet

Instagram is not connected. `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` and
`FACEBOOK_APP_SECRET` are absent, so the Meta OAuth round trip and the comment
webhook are inert until a Meta app exists. Everything else runs.

<!-- auto-deploy webhook probe 2026-08-02 -->
