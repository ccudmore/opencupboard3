#!/usr/bin/env bash
# Creates the first administrator. Run from the folder containing docker-compose.yml:
#   ./bootstrap.sh
# Safe to run again: it does nothing if an administrator already exists.
set -euo pipefail

MIN_PASSWORD_LENGTH=12

read -rp "Admin email: " ADMIN_EMAIL
read -rp "Admin name (optional): " ADMIN_NAME
read -rsp "Admin password (leave empty to promote an existing account): " ADMIN_PW; echo

if [[ -n "${ADMIN_PW}" ]]; then
	if (( ${#ADMIN_PW} < MIN_PASSWORD_LENGTH )); then
		echo "Password must be at least ${MIN_PASSWORD_LENGTH} characters." >&2
		exit 1
	fi
	read -rsp "Repeat password: " ADMIN_PW2; echo
	if [[ "${ADMIN_PW}" != "${ADMIN_PW2}" ]]; then
		echo "Passwords do not match." >&2
		exit 1
	fi
fi

# Export the values and pass them to the container by name only, so the
# password never appears in the command line or the process list.
export BOOTSTRAP_ADMIN_EMAIL="${ADMIN_EMAIL}"
export BOOTSTRAP_ADMIN_NAME="${ADMIN_NAME}"
export BOOTSTRAP_ADMIN_PASSWORD="${ADMIN_PW}"
trap 'unset BOOTSTRAP_ADMIN_PASSWORD ADMIN_PW ADMIN_PW2' EXIT

docker compose run --rm \
	-e BOOTSTRAP_ADMIN_EMAIL \
	-e BOOTSTRAP_ADMIN_NAME \
	-e BOOTSTRAP_ADMIN_PASSWORD \
	db-push tsx prisma/bootstrap-admin.ts
