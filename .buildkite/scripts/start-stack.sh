#!/usr/bin/env bash
  # Shared by the API and UI test steps. Source it after setup.sh:
  # it starts Postgres and the API, then waits until the API is healthy.

  docker compose -f infra/docker-compose.yml up -d --wait
  pnpm exec turbo run build --filter=@shop/api...
  pnpm --filter @shop/db migrate:deploy
  pnpm db:seed
  pnpm db:seed:demo

  pnpm --filter @shop/api start > api.log 2>&1 &

  if ! curl -fsS --retry 30 --retry-delay 2 --retry-connrefused http://localhost:4000/api/health; then
    echo "API did not start. Log:"
    cat api.log
    exit 1
  fi