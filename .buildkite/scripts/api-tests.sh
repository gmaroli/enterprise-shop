#!/usr/bin/env bash
 # Starts the stack and runs the API tests.
set -euo pipefail

source .buildkite/scripts/setup.sh
export E2E_ADMIN_PASSWORD="$(buildkite-agent secret get E2E_ADMIN_PASSWORD)"
export E2E_CUSTOMER_PASSWORD="$(buildkite-agent secret get E2E_CUSTOMER_PASSWORD)"

source .buildkite/scripts/start-stack.sh

pnpm test:api