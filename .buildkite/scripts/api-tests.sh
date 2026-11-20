#!/usr/bin/env bash
# Starts the stack (Postgres in Docker, the API on this machine) and runs the API tests.
set -euo pipefail

source .buildkite/scripts/setup.sh
export E2E_ADMIN_PASSWORD="$(buildkite-agent secret get E2E_ADMIN_PASSWORD)"
export E2E_CUSTOMER_PASSWORD="$(buildkite-agent secret get E2E_CUSTOMER_PASSWORD)"

docker compose -f infra/docker-compose.yml up -d --wait
pnpm --filter @shop/db generate
pnpm --filter @shop/db migrate:deploy
pnpm db:seed
pnpm db:seed:demo

pnpm exec turbo run build --filter=@shop/api...
pnpm --filter @shop/api start > api.log 2>&1 &

if ! curl -fsS --retry 30 --retry-delay 2 --retry-connrefused http://localhost:4000/api/health; then
echo "API did not start. Log:"
cat api.log
exit 1
fi

pnpm test:api