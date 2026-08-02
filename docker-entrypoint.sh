#!/bin/sh
# One image, both OpenReply processes. Coolify runs the same build twice and
# picks the role with PROCESS_ROLE, so web and worker can never drift apart on
# ENCRYPTION_KEY / DATABASE_URL / REDIS_URL, which would break token decryption.
set -e

role="${PROCESS_ROLE:-web}"

case "$role" in
  worker)
    echo "[entrypoint] role=worker"
    exec npm run worker
    ;;
  migrate)
    echo "[entrypoint] role=migrate"
    exec npx prisma migrate deploy
    ;;
  web)
    if [ "${RUN_MIGRATIONS}" = "true" ]; then
      echo "[entrypoint] applying migrations before boot"
      npx prisma migrate deploy
    fi
    echo "[entrypoint] role=web on port ${PORT}"
    exec npm run start
    ;;
  *)
    echo "[entrypoint] unknown PROCESS_ROLE=$role (expected web|worker|migrate)" >&2
    exit 1
    ;;
esac
