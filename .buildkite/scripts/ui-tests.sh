 #!/usr/bin/env bash
  # Starts the full stack (database, API, web app) and runs the UI tests in Chromium.
  set -euo pipefail

  source .buildkite/scripts/setup.sh
  export E2E_ADMIN_PASSWORD="$(buildkite-agent secret get E2E_ADMIN_PASSWORD)"
  export E2E_CUSTOMER_PASSWORD="$(buildkite-agent secret get E2E_CUSTOMER_PASSWORD)"

  pnpm --filter @shop/e2e exec playwright install --with-deps chromium

  source .buildkite/scripts/start-stack.sh

  pnpm exec turbo run build --filter=@shop/web...
  pnpm --filter @shop/web start > web.log 2>&1 &

  if ! curl -fsS --retry 30 --retry-delay 2 --retry-connrefused http://localhost:3001/ > /dev/null; then
    echo "Web app did not start. Log:"
    cat web.log
    exit 1
  fi

  pnpm test:ui