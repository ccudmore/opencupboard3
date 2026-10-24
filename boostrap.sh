read -rsp "Admin password: "ADMIN_PW;
echo docker compose run --rm \
 -e BOOTSTRAP_ADMIN_EMAIL=you@example.org \
 -eBOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PW" \
 db-push tsx prisma/bootstrap-admin.ts
unset ADMIN_PW