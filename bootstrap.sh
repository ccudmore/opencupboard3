#!/usr/bin/env bash
set -euo pipefail
read -rp "Admin email: " ADMIN_EMAIL; echo
read -rsp "Admin password: " ADMIN_PW; echo
docker compose run --rm -e BOOTSTRAP_ADMIN_EMAIL="$ADMIN_EMAIL" -e BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PW" db-push tsx prisma/bootstrap-admin.ts
